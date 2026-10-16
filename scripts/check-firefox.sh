#!/usr/bin/env bash
#
# Installs the packaged extension into a throwaway Firefox profile and checks
# that a page really gets rewritten.
#
# `web-ext lint` says the manifest is acceptable. This says the artifact runs,
# and it does it the way a dogfooding install does: the built XPI, put where
# Firefox looks for one, with the pref that stops Firefox switching off an
# extension it found by itself.
#
# It is worth having because the interesting failure on Firefox is silent: if
# storage.sync were unavailable there, reading the settings would reject, the
# content script would never sweep, and every page would simply look untouched.
#
# Playwright cannot drive stock Firefox with an extension loaded, so the fixture
# page reports its own text back to the fixture server instead.
#
# Usage:  scripts/check-firefox.sh
#   FIREFOX=/path/to/firefox   to choose the browser (default: firefox, then
#                              firefox-devedition, from PATH)

set -euo pipefail

cd "$(dirname "$0")/.."

FIREFOX="${FIREFOX:-$(command -v firefox || command -v firefox-devedition || true)}"
if [ -z "$FIREFOX" ]; then
  echo "check-firefox: no firefox found; set FIREFOX=/path/to/firefox" >&2
  exit 2
fi

echo "==> packaging"
pnpm package > /dev/null

xpi=$(ls artifacts/*.xpi)
addon_id=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync("dist/manifest.json", "utf8")).browser_specific_settings.gecko.id)')

work=$(mktemp -d)
profile="$work/profile"
report="$work/report.txt"
port="${PORT:-4173}"

mkdir -p "$profile/extensions"
printf 'user_pref("extensions.autoDisableScopes", 0);\n' > "$profile/user.js"
cp "$xpi" "$profile/extensions/$addon_id.xpi"

REPORT_PATH="$report" PORT="$port" node tests/fixtures/serve.mjs > "$work/server.log" 2>&1 &
server=$!

"$FIREFOX" -profile "$profile" -headless -no-remote \
  "http://127.0.0.1:$port/firefox.html" > "$work/firefox.log" 2>&1 &
browser=$!

cleanup() {
  kill "$browser" "$server" 2>/dev/null || true
  wait "$browser" "$server" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if [ -s "$report" ]; then
    break
  fi
  sleep 1
done

if [ ! -s "$report" ]; then
  echo "check-firefox: the fixture page never reported back" >&2
  echo "--- firefox said:" >&2
  tail -20 "$work/firefox.log" >&2
  exit 1
fi

hero="$(cat "$report")"
expected="LLM is coming for your job"

if [ "$hero" != "$expected" ]; then
  echo "check-firefox: FAIL — the page said '$hero', expected '$expected'" >&2
  exit 1
fi

echo "check-firefox: ok — $xpi installed into a fresh profile and the page reads '$hero'"
