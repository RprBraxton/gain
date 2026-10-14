"use strict";
// Two-way family sync (Supabase). Optional: app works fully offline without it.
const SB_URL="https://renuyeotuanzxbncitxq.supabase.co";
const SB_ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbnV5ZW90dWFuenhibmNpdHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMDQ2MDcsImV4cCI6MjEwNzU4MDYwN30.chVxWLVdFxkUtWQL6PR-bzlIVfY7PWxsYrlfv7k9ARk"; // public anon key; RLS limits access to family members
const SYNC_KEY="gain.sync";
const Y=Object.assign({snap:{},lastPull:null,uploaded:{},lastSync:null},JSON.parse(localStorage.getItem(SYNC_KEY)||"{}"));
const ySave=()=>localStorage.setItem(SYNC_KEY,JSON.stringify(Y));
let sb=null,session=null,status="local",allowed=null,busy=false,chan=null,lastErr="";
try{if(window.supabase)sb=supabase.createClient(SB_URL,SB_ANON,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"gain.auth"}})}catch(e){}
function localEntries(){const out={};for(const c of COLS)for(const[id,r]of Object.entries(S.col[c]))out[c+":"+id]={kind:c,id,data:r,u:r.updated||0};return out}
function dirty(){const cur=localEntries(),rows=[];
  for(const[k,e]of Object.entries(cur))if(Y.snap[k]!==e.u)rows.push({kind:e.kind,id:e.id,data:e.data,updated_at:e.u,deleted:false});
  for(const k of Object.keys(Y.snap))if(!cur[k]&&Y.snap[k]!==-1){const i=k.indexOf(":"),kind=k.slice(0,i),id=k.slice(i+1);rows.push({kind,id,data:null,updated_at:Math.max(S.deleted[k]||0,Date.now()),deleted:true})}
  for(const k of Object.keys(S.deleted))if(!(k in Y.snap)&&!cur[k]){const i=k.indexOf(":");rows.push({kind:k.slice(0,i),id:k.slice(i+1),data:null,updated_at:S.deleted[k],deleted:true})}
  return rows}
async function upPhoto(pid){if(Y.uploaded[pid])return;const v=await pGet(pid);if(!v)return;const blob=await (await fetch(v)).blob();
  const {error}=await sb.storage.from("photos").upload(pid+".jpg",blob,{contentType:"image/jpeg",upsert:true});if(error&&!/exists|Duplicate/i.test(error.message))throw error;Y.uploaded[pid]=1;ySave()}
async function downPhoto(pid){if(!pid||await pGet(pid))return;const {data,error}=await sb.storage.from("photos").download(pid+".jpg");if(error||!data)return;
  const url=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(data)});await pPut(pid,url);Y.uploaded[pid]=1}
async function push(){const rows=dirty();if(!rows.length)return 0;for(const r of rows)if(r.kind==="photos"&&!r.deleted)await upPhoto(r.data.photo);
  for(let i=0;i<rows.length;i+=200){const {error}=await sb.from("entries").upsert(rows.slice(i,i+200),{onConflict:"kind,id"});if(error)throw error}
  for(const r of rows)Y.snap[r.kind+":"+r.id]=r.deleted?-1:r.updated_at;ySave();return rows.length}
async function applyRow(r){if(!COLS.includes(r.kind))return false;const key=r.kind+":"+r.id,cur=S.col[r.kind][r.id];
  if(cur&&(cur.updated||0)>r.updated_at)return false;if(Y.snap[key]===(r.deleted?-1:r.updated_at))return false;
  if(r.deleted){if((S.deleted[key]||0)>=r.updated_at&&!cur){Y.snap[key]=-1;return false}delete S.col[r.kind][r.id];S.deleted[key]=r.updated_at;Y.snap[key]=-1}
  else{if((S.deleted[key]||0)>=r.updated_at)return false;if(r.kind==="photos")await downPhoto(r.data.photo);S.col[r.kind][r.id]=r.data;Y.snap[key]=r.updated_at}
  return true}
async function pull(){let q=sb.from("entries").select("*").order("server_ts",{ascending:true}).limit(1000);if(Y.lastPull)q=q.gt("server_ts",Y.lastPull);
  const {data,error}=await q;if(error)throw error;let ch=0;for(const r of data){if(await applyRow(r))ch++;Y.lastPull=r.server_ts}
  if(ch){localStorage.setItem(KEY,JSON.stringify(S));refreshUI()}ySave();return data.length===1000}
function refreshUI(){const busyUI=!$("#sheet").classList.contains("hidden")||document.activeElement?.tagName==="INPUT";if(busyUI)setTimeout(refreshUI,1500);else render()}
async function syncNow(){if(!sb||!session||busy)return;if(!navigator.onLine){setStatus("offline");return}
  busy=true;setStatus("syncing");try{if(allowed===null){const {data}=await sb.from("members").select("uid");allowed=!!(data&&data.length)}
    if(!allowed&&famCode())allowed=await tryJoin(famCode());
    if(!allowed){setStatus("denied");return}
    while(await pull());await push();Y.lastSync=Date.now();ySave();setStatus("synced");subscribe()}
  catch(e){lastErr=e.message||String(e);setStatus("error")}finally{busy=false}}
function subscribe(){if(chan||!session)return;chan=sb.channel("entries").on("postgres_changes",{event:"*",schema:"public",table:"entries"},async p=>{const r=p.new;if(!r||!r.kind)return;
  if(await applyRow(r)){localStorage.setItem(KEY,JSON.stringify(S));ySave();refreshUI()}}).subscribe()}
let pushT=null;window.onLocalSave=()=>{if(!session)return;clearTimeout(pushT);pushT=setTimeout(syncNow,800)};
function setStatus(s){status=s;const c=document.getElementById("syncCard");if(c)c.innerHTML=syncCardInner()}
const ST={title:"Family sync",local:"Not connected — data stays on this phone only.",syncing:"Syncing…",synced:"Synced",offline:"Offline — changes saved, will sync later.",error:"Sync problem — will retry.",denied:"Family code not accepted.",joining:"Connecting…"};
function syncCardInner(){if(!sb)return `<h2>☁️ ${ST.title}</h2><p class="mute">${ST.local}</p>`;
  const dot={synced:"🟢",syncing:"🔄",offline:"🟡",error:"🔴",denied:"⛔",local:"⚪",joining:"🔄"}[status]||"⚪";
  if(!session||!allowed)return `<h2>☁️ ${ST.title}</h2><p>${dot} ${ST[status]||ST.local}</p><p class="mute small">Enter the family code on each phone to share profiles, meals, workouts and photos. Once per phone.</p><input id="syCode" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="word-word-word-00" value="${esc(famCode()||"")}"><button class="btn" id="syJoin">Join family</button><p class="small mute">${esc(joinMsg)}</p>`;
  return `<h2>☁️ ${ST.title}</h2><p>${dot} ${ST[status]||status}${status==="synced"&&Y.lastSync?" · "+new Date(Y.lastSync).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):""}</p>${status==="error"?`<p class="small mute">${esc(lastErr)}</p>`:""}<div class="row"><button class="btn sec" id="syNow">Sync now</button><button class="btn ghost" id="syOut">Disconnect</button></div>`}
function syncSoon(){busy?setTimeout(syncSoon,300):syncNow()}
let joinMsg="";const FKEY="gain.familyCode";const famCode=()=>localStorage.getItem(FKEY);
async function tryJoin(code){code=(code||"").trim().toLowerCase().replace(/\s+/g,"");if(!code)return false;
  if(!session){const {data,error}=await sb.auth.signInAnonymously();if(error){joinMsg=error.message;return false}session=data.session}
  const {data,error}=await sb.rpc("join_family",{code});
  if(error){joinMsg=/too many/i.test(error.message)?"Too many tries — wait 15 minutes.":error.message;return false}
  if(!data){joinMsg="That code didn't work.";localStorage.removeItem(FKEY);return false}
  localStorage.setItem(FKEY,code);joinMsg="";return true}
document.addEventListener("click",async e=>{const id=e.target.id;if(!sb)return;
  if(id==="syJoin"){const v=$("#syCode").value;setStatus("joining");allowed=await tryJoin(v);if(allowed)syncSoon();else setStatus("denied")}
  if(id==="syNow")syncNow();
  if(id==="syOut"){try{await sb.rpc("leave_family")}catch(_){}localStorage.removeItem(FKEY);allowed=null;await sb.auth.signOut();session=null;setStatus("local")}});
if(sb){sb.auth.onAuthStateChange((ev,s)=>{const was=session?.user?.id;session=s;if(!s){allowed=null;if(chan){sb.removeChannel(chan);chan=null}setStatus("local");return}
    if(was!==s.user.id){allowed=null;if(Y.user&&Y.user!==s.user.id){Y.snap={};Y.lastPull=null}Y.user=s.user.id;ySave();setTimeout(syncNow,0)}else setStatus(status)});
  sb.auth.getSession().then(async({data})=>{if(!data.session&&famCode()&&navigator.onLine){allowed=await tryJoin(famCode());if(allowed)syncSoon()}});
  addEventListener("online",()=>{if(!session&&famCode())tryJoin(famCode()).then(a=>{allowed=a;syncSoon()});else syncNow()});addEventListener("offline",()=>setStatus("offline"));setInterval(syncNow,60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)syncNow()})}
window.gainSync={syncNow,get status(){return status}};
