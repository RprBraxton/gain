-- Gain app sync schema: anonymous auth + shared family code (hashed) -> members; RLS allows only members.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.family_secret (id int primary key default 1 check (id=1), code_hash text not null, updated_at timestamptz default now());
create table if not exists public.members (uid uuid primary key references auth.users(id) on delete cascade, joined_at timestamptz default now());
create table if not exists public.join_attempts (id bigserial primary key, uid uuid, ok boolean, at timestamptz default now());
alter table public.family_secret enable row level security;
alter table public.members enable row level security;
alter table public.join_attempts enable row level security;
-- no policies on family_secret/join_attempts: not readable by clients
drop policy if exists "self member" on public.members;
create policy "self member" on public.members for select to authenticated using (uid = auth.uid());
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.uid = auth.uid());
$$;
revoke all on function public.is_member() from public; grant execute on function public.is_member() to authenticated;
create or replace function public.join_family(code text) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text; recent_user int; recent_all int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where uid = auth.uid()) then return true; end if;
  select count(*) into recent_user from join_attempts where uid = auth.uid() and not ok and at > now() - interval '15 minutes';
  select count(*) into recent_all from join_attempts where not ok and at > now() - interval '15 minutes';
  if recent_user >= 5 or recent_all >= 30 then raise exception 'too many attempts, try again later'; end if;
  select code_hash into h from family_secret where id = 1;
  if h is not null and crypt(lower(trim(code)), h) = h then
    insert into members(uid) values (auth.uid()) on conflict do nothing;
    insert into join_attempts(uid, ok) values (auth.uid(), true);
    return true;
  end if;
  insert into join_attempts(uid, ok) values (auth.uid(), false);
  perform pg_sleep(1.5);
  return false;
end $$;
revoke all on function public.join_family(text) from public; grant execute on function public.join_family(text) to authenticated;
create or replace function public.leave_family() returns void language sql security definer set search_path = public as $$ delete from members where uid = auth.uid(); $$;
grant execute on function public.leave_family() to authenticated;
-- data
create table if not exists public.entries (
  kind text not null check (kind ~ '^[a-z_]{2,20}$'),
  id text not null, data jsonb, updated_at bigint not null, deleted boolean not null default false,
  updated_by uuid default auth.uid(), server_ts timestamptz not null default now(), primary key (kind,id));
alter table public.entries enable row level security;
alter table public.entries replica identity full;
drop policy if exists "allowlisted read" on public.entries; drop policy if exists "allowlisted insert" on public.entries; drop policy if exists "allowlisted update" on public.entries;
drop policy if exists "members read" on public.entries; drop policy if exists "members insert" on public.entries; drop policy if exists "members update" on public.entries;
create policy "members read" on public.entries for select to authenticated using (public.is_member());
create policy "members insert" on public.entries for insert to authenticated with check (public.is_member());
create policy "members update" on public.entries for update to authenticated using (public.is_member()) with check (public.is_member());
create or replace function public.lww() returns trigger language plpgsql as $$
begin if new.updated_at < old.updated_at then return old; end if; new.server_ts := now(); return new; end $$;
drop trigger if exists entries_lww on public.entries;
create trigger entries_lww before update on public.entries for each row execute function public.lww();
do $$ begin alter publication supabase_realtime add table public.entries; exception when duplicate_object then null; end $$;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('photos','photos',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
drop policy if exists "photos read" on storage.objects; drop policy if exists "photos insert" on storage.objects; drop policy if exists "photos update" on storage.objects;
create policy "photos read" on storage.objects for select to authenticated using (bucket_id='photos' and public.is_member());
create policy "photos insert" on storage.objects for insert to authenticated with check (bucket_id='photos' and public.is_member());
create policy "photos update" on storage.objects for update to authenticated using (bucket_id='photos' and public.is_member());
