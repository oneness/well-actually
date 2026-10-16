#!/usr/bin/env bash
#
# Verifies the store archives, rather than the directory they were made from.
#
# That distinction is the point: what gets uploaded is the archive, so the
# archive is what should be tested. This checks that both are valid zips, that
# their contents are the build output byte for byte, that each store sees the
# manifest it needs, that Mozilla's own linter accepts the Firefox one, and that
# the Chrome one still works — by loading it into Chromium and running the whole
# end-to-end suite against it.
#
# Run this before submitting anything. On NixOS, run it inside `nix develop`,
# because the Chromium step needs the browser bundle from nixpkgs.
#
# Usage:  scripts/check-package.sh

set -euo pipefail

cd "$(dirname "$0")/.."

fail() {
  echo "check-package: FAIL — $*" >&2
  exit 1
}

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "==> packaging"
pnpm package

chrome_zip=$(ls artifacts/*-chrome.zip)
firefox_zip=$(ls artifacts/*-firefox.zip)

echo "==> the same sources produce the same bytes"
before=$(sha256sum "$chrome_zip" "$firefox_zip")
pnpm package > /dev/null
after=$(sha256sum "$chrome_zip" "$firefox_zip")
[ "$before" = "$after" ] || fail "packaging twice produced different archives"

echo "==> both archives are readable"
unzip -t "$chrome_zip" > /dev/null || fail "the Chrome archive is corrupt"
unzip -t "$firefox_zip" > /dev/null || fail "the Firefox archive is corrupt"

unzip -q -o "$chrome_zip" -d "$work/chrome"
unzip -q -o "$firefox_zip" -d "$work/firefox"

echo "==> their contents are the build output"
# The Chrome manifest is the one file that is deliberately not the build's.
diff -r -x '*.map' -x '*.svg' -x 'manifest.json' dist "$work/chrome" > /dev/null ||
  fail "the Chrome archive differs from the build"
diff -r -x '*.map' -x '*.svg' dist "$work/firefox" > /dev/null ||
  fail "the Firefox archive differs from the build"

echo "==> each store sees the manifest it needs"
grep -q browser_specific_settings "$work/chrome/manifest.json" &&
  fail "the Chrome manifest still carries Firefox-only keys"
grep -q '"id"' "$work/firefox/manifest.json" ||
  fail "the Firefox manifest has no add-on id, which storage.sync needs"
grep -q data_collection_permissions "$work/firefox/manifest.json" ||
  fail "the Firefox manifest does not declare what it collects"

echo "==> Mozilla's linter accepts the Firefox archive"
pnpm exec web-ext lint --source-dir "$work/firefox" --warnings-as-errors

echo "==> the Chrome archive works in Chromium"
WA_EXTENSION_DIR="$work/chrome" pnpm test:e2e

echo
echo "check-package: ok"
echo "  $chrome_zip"
echo "  $firefox_zip"
