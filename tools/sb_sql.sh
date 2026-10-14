#!/bin/bash
# Run SQL (file or stdin) against the Gain Supabase project via the Management API.
# Token from $SUPABASE_ACCESS_TOKEN or /home/box/shared/isaiah/sb_token.txt (never commit it).
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-renuyeotuanzxbncitxq}"
TOKEN="${SUPABASE_ACCESS_TOKEN:-$(cat /home/box/shared/isaiah/sb_token.txt)}"
SQL=$(cat "${1:-/dev/stdin}")
python3 -c 'import json,sys;print(json.dumps({"query":sys.stdin.read()}))' <<<"$SQL" | curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @- "https://api.supabase.com/v1/projects/$REF/database/query"; echo
