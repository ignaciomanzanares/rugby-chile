#!/usr/bin/env bash
# Levanta el proxy residencial de arusa + el túnel de Cloudflare, e imprime la
# URL pública para pegar en ARUSA_PROXY (Render). Correlo en tu máquina antes de
# los partidos (tu IP residencial es la única que arusa deja para el minuto-a-
# minuto). Ctrl+C corta ambos.
set -euo pipefail
PORT="${PORT:-8788}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CF="${CLOUDFLARED:-$HOME/.local/bin/cloudflared}"

command -v node >/dev/null || { echo "falta node"; exit 1; }
[ -x "$CF" ] || command -v cloudflared >/dev/null || { echo "falta cloudflared ($CF)"; exit 1; }
[ -x "$CF" ] || CF="$(command -v cloudflared)"

echo "→ proxy local en :$PORT"
PORT="$PORT" node "$DIR/local-proxy.mjs" &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null; kill ${TUN_PID:-0} 2>/dev/null' EXIT

sleep 1
LOG="$(mktemp)"
echo "→ abriendo túnel…"
"$CF" tunnel --url "http://localhost:$PORT" --no-autoupdate > "$LOG" 2>&1 &
TUN_PID=$!

for _ in $(seq 1 25); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "${URL:-}" ] && break
  sleep 1
done

if [ -z "${URL:-}" ]; then echo "no salió la URL del túnel; ver $LOG"; wait; fi

echo
echo "==================================================================="
echo " URL pública (pegar en ARUSA_PROXY de Render):"
echo "   $URL"
echo "==================================================================="
echo " Dejá esta ventana abierta durante los partidos. Ctrl+C para cortar."
echo
wait
