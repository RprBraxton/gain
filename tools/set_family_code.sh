#!/bin/bash
# Set/rotate the family code. Stores only a bcrypt hash in the DB. Optionally removes existing members (--reset-members).
# Usage: tools/set_family_code.sh [--reset-members]   (reads code from /home/box/shared/gain/family_code.txt or $FAMILY_CODE)
set -euo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
CODE="${FAMILY_CODE:-$(cat /home/box/shared/gain/family_code.txt)}"
CODE=$(printf '%s' "$CODE" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
[[ "$CODE" =~ ^[a-z0-9-]{8,64}$ ]] || { echo "code must be 8-64 chars of a-z, 0-9, -"; exit 1; }
RESET=""; [ "${1:-}" = "--reset-members" ] && RESET="delete from public.members;"
"$DIR/sb_sql.sh" <<SQL >/dev/null
insert into public.family_secret(id,code_hash,updated_at) values (1, extensions.crypt('$CODE', extensions.gen_salt('bf',10)), now())
on conflict (id) do update set code_hash=excluded.code_hash, updated_at=now(); $RESET
SQL
echo "family code hash updated"
