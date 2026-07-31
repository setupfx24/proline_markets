#!/usr/bin/env bash
# ============================================================================
# Safe production redeploy.
#
#   ./deploy/redeploy.sh                       # the four services that usually change
#   ./deploy/redeploy.sh trader-frontend       # just one
#
# Why this exists: running `compose build` for both frontends at once, then
# `up -d`, is how the site ends up 502-ing after a deploy. Two Next.js builds
# run in parallel with --max-old-space-size=4096 each, so on a small box the
# OOM killer takes out whatever is running — including the live frontend — and
# if a build then fails, nothing brings it back.
#
# This script fixes that by:
#   1. building services ONE AT A TIME (never two Node builds at once),
#   2. building EVERYTHING FIRST and only swapping containers if every build
#      succeeded — a broken build can no longer take the site down,
#   3. waiting for each container to actually answer before moving on, so you
#      know the deploy is live instead of guessing.
# ============================================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

# Cache-busts the frontend JS so browsers don't serve the old bundle.
export APP_VERSION="${APP_VERSION:-$(date +%Y%m%d-%H%M%S)}"

SERVICES=("$@")
if [ ${#SERVICES[@]} -eq 0 ]; then
  SERVICES=(market-data admin-api trader-frontend admin-frontend)
fi

# Published health endpoint per service (empty = container-state check only).
health_url() {
  case "$1" in
    trader-frontend) echo "http://127.0.0.1:3012" ;;
    admin-frontend)  echo "http://127.0.0.1:3013" ;;
    admin-api)       echo "http://127.0.0.1:8003/health" ;;
    gateway)         echo "http://127.0.0.1:8002/health" ;;
    *)               echo "" ;;
  esac
}

wait_ready() {
  local svc=$1 url timeout=${2:-150} deadline
  url=$(health_url "$svc")
  deadline=$((SECONDS + timeout))

  if [ -z "$url" ]; then
    while [ $SECONDS -lt $deadline ]; do
      case "$("${COMPOSE[@]}" ps --format '{{.State}}' "$svc" 2>/dev/null | head -1)" in
        running) echo "   OK   $svc is running"; return 0 ;;
        restarting|exited|dead) break ;;
      esac
      sleep 2
    done
  else
    while [ $SECONDS -lt $deadline ]; do
      if curl -fsS -o /dev/null --max-time 3 "$url"; then
        echo "   OK   $svc answering on ${url}"
        return 0
      fi
      sleep 2
    done
  fi

  echo "   FAIL $svc did not come up in ${timeout}s"
  echo "        docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 $svc"
  return 1
}

echo "==> Redeploying: ${SERVICES[*]}"
echo "    APP_VERSION=$APP_VERSION"
echo

# ── 1. Build everything first, one service at a time ────────────────────────
# No --no-cache: a source change already invalidates the builder's `COPY . .`
# layer, so the app rebuilds anyway. --no-cache would also re-run `npm ci`,
# which doubles the time and the memory pressure for no benefit.
for svc in "${SERVICES[@]}"; do
  echo "==> Building $svc"
  "${COMPOSE[@]}" build "$svc"
  echo
done

echo "==> All builds succeeded — swapping containers"
echo

# ── 2. Swap + verify, one at a time ─────────────────────────────────────────
failed=()
for svc in "${SERVICES[@]}"; do
  echo "==> Starting $svc"
  "${COMPOSE[@]}" up -d --no-deps "$svc"
  wait_ready "$svc" || failed+=("$svc")
  echo
done

"${COMPOSE[@]}" ps

if [ ${#failed[@]} -gt 0 ]; then
  echo
  echo "!! These services are NOT healthy: ${failed[*]}"
  exit 1
fi

echo
echo "==> Deploy OK"
if printf '%s\n' "${SERVICES[@]}" | grep -qx market-data; then
  echo "    Infoway subscription:"
  "${COMPOSE[@]}" logs --tail=200 market-data 2>/dev/null \
    | grep -i "Infoway subscription\|subscribed depth" | tail -5 || true
fi
