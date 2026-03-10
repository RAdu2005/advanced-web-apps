#!/usr/bin/env bash
set -euo pipefail

WEB_PORT="${WEB_PORT:-4173}"

node apps/api/dist/server.js &
api_pid=$!

npm run preview -w apps/web -- --host 0.0.0.0 --port "${WEB_PORT}" &
web_pid=$!

cleanup() {
  kill "${api_pid}" "${web_pid}" 2>/dev/null || true
}

trap cleanup INT TERM

wait -n "${api_pid}" "${web_pid}"
exit_code=$?

cleanup
wait "${api_pid}" 2>/dev/null || true
wait "${web_pid}" 2>/dev/null || true

exit "${exit_code}"
