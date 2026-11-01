#!/usr/bin/env bash
# Shows Play together's recovery keys, so a friend who lost theirs can ask the owner.
# Needs the owner's Cloudflare login. Usage: ./keys.sh [friend code]
set -euo pipefail
cd "$(dirname "$0")"

where=""
if [[ $# -gt 0 ]]; then
  code=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  [[ "$code" =~ ^[a-z0-9]{3,20}$ ]] || { echo "That isn't a friend code." >&2; exit 1; }
  where="WHERE code = '$code'"
fi
npx wrangler d1 execute umpoint-together --remote --command "SELECT code, name, recovery_key FROM users $where ORDER BY code"
