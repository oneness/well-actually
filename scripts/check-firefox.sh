#!/usr/bin/env bash
#
# Loads the built extension into a real Firefox and checks that a page actually
# gets rewritten.
#
# `web-ext lint` says the manifest is acceptable; this says the extension runs.
# It is worth having because the interesting failure on Firefox is silent: if
# storage.sync is unavailable, reading the settings rejects, the content script
# never sweeps, and every page simply looks untouched. Chromium cannot tell us
# that, and Playwright cannot drive stock Firefox with an extension loaded, so
# the fixture page reports its own text back to the fixture server instead.
#
# Usage:  scripts/check-firefox.sh
#   FIREFOX=/path/to/firefox   to choose the browser (default: whatever is on PATH)

set -euo pipefail

cd "$(dirname "$0")/.."

FIREFOX="${FIREFOX:-$(command -v firefox || command -v firefox-devedition || true)}"
if [ -z "$FIREFOX" ]; then
  echo "check-firefox: no firefox found; set FIREFOX=/path/to/firefox" >&2
  exit 2
fi

if [ ! -f dist/manifest.json ]; then
  echo "check-firefox: dist/ is not built; run pnpm build" >&2
  exit 2
fi

PORT="${PORT:-4173}"
REPORT_PATH="$(mktemp -d)/report.txt"
export REPORT_PATH

server_pid=""
browser_pid=""
cleanup() {
  [ -n "$browser_pid" ] && kill "$browser_pid" 2>/dev/null || true
  [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT

PORT="$PORT" node tests/fixtures/serve.mjs &
server_pid=$!

pnpm exec web-ext run \
  --source-dir dist \
  --firefox "$FIREFOX" \
  --args=-headless \
  --start-url "http://127.0.0.1:$PORT/firefox.html" \
  --no-reload \
  --no-input &
browser_pid=$!

for _ in $(seq 1 60); do
  if [ -s "$REPORT_PATH" ]; then
    break
  fi
  sleep 1
done

if [ ! -s "$REPORT_PATH" ]; then
  echo "check-firefox: the fixture page never reported back" >&2
  exit 1
fi

hero="$(cat "$REPORT_PATH")"
expected="LLM is coming for your job"

if [ "$hero" != "$expected" ]; then
  echo "check-firefox: FAIL — the page said '$hero', expected '$expected'" >&2
  exit 1
fi

echo "check-firefox: ok — Firefox rewrote the page to '$hero'"
