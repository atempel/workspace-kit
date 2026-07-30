#!/usr/bin/env bash
#
# Boots both dashboard implementations side by side against ONE data server, so
# the only difference between the two screens is the front end.
#
#   web/  — this branch (dashboard)            http://127.0.0.1:4330
#   app/  — branch worktree-dashboard          http://127.0.0.1:4321
#   API   — core/server.js, shared by both     http://127.0.0.1:4319
#
# Both front ends proxy /api to 4319, and the payload the newer server returns
# is a superset of the older one, so a single server can feed both honestly.
#
# THROWAWAY. Only one of the two implementations is meant to survive
# (see SESSIONS.md, 2026-07-29). Delete this script once that is decided.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${1:-$here}"
app_dir="${WSKIT_APP_DIR:-$(cd "$here/../inspect-layer" 2>/dev/null && pwd || true)/app}"

if [ ! -d "$app_dir" ]; then
  echo "The app/ implementation was not found at: $app_dir" >&2
  echo "It lives on branch worktree-dashboard. Check it out, then set WSKIT_APP_DIR." >&2
  exit 1
fi

pids=()
cleanup() { for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

echo "==> API      node bin/workspace-kit.js serve $target"
node "$here/bin/workspace-kit.js" serve "$target" & pids+=($!)

echo "==> web/     http://127.0.0.1:4330"
npm --prefix "$here/web" run dev >/dev/null & pids+=($!)

echo "==> app/     http://127.0.0.1:4321"
(cd "$app_dir" && npm run dev >/dev/null) & pids+=($!)

# Probe rather than sleep-and-hope. A stale server left on one of these ports
# answers just fine, so "the port responds" is not the same as "the thing I just
# started is what is answering" — but a port that never comes up at all is the
# common failure, and announcing success over it is worse than useless.
probe() {
  local url="$1" name="$2"
  for _ in $(seq 1 40); do
    if curl -sf -o /dev/null "$url"; then echo "    ok    $name  $url"; return 0; fi
    sleep 0.5
  done
  echo "    FAIL  $name  $url  (did not come up — port already in use?)" >&2
  return 1
}

echo
failed=0
probe "http://127.0.0.1:4319/api/dashboard" "API " || failed=1
probe "http://127.0.0.1:4330/"              "web/" || failed=1
probe "http://127.0.0.1:4321/"              "app/" || failed=1
echo

if [ "$failed" -ne 0 ]; then
  echo "Not everything started. Check for leftovers:  pkill -f vite ; pkill -f 'workspace-kit.js serve'" >&2
  exit 1
fi

echo "Open them in two tabs:"
echo "  web/  http://127.0.0.1:4330"
echo "  app/  http://127.0.0.1:4321"
echo
echo "Ctrl-C stops all three."
wait
