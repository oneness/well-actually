# Submitting

What each store needs, and what is still missing. Store requirements move; the
figures here are as of the last check, and the repository-side facts are exact.

## Before either store

One source of truth for the version: `package.json`. `build.mjs` stamps it into
the manifest, and `package.mjs` names the archives after it. So:

```sh
# bump "version" in package.json
pnpm check          # typecheck, unit tests, build, manifest lint
pnpm check:package  # the archives, and the archives loaded into Chromium
git tag v0.1.0 && git push --tags
```

`pnpm check:package` is the one that matters for a release: it verifies the
archives themselves, not the directory they came from. Because the archives are
byte-for-byte reproducible, a published file can be regenerated from the tag it
was built at.

## What gets uploaded

```
artifacts/well-actually-<version>-chrome.zip
artifacts/well-actually-<version>-firefox.zip
```

Ten files each, `manifest.json` at the root, no source maps. The only
difference between them is the manifest: the Chrome archive has
`browser_specific_settings` removed, because Chrome warns about keys it cannot
use and that warning would sit in front of a reviewer. `scripts/check-package.sh`
asserts that difference is the only one.

## Chrome Web Store

- **Upload** the `-chrome.zip`.
- **Registration** is a one-time $5 fee for a developer account, with no annual
  renewal.
- **Listing**: name, summary (132 characters), description, category
  (Productivity), language. The 128×128 icon comes from the archive.
- **Images**: at least one screenshot at 1280×800 or 640×400. The 440×280 promo
  tile and the 1400×560 marquee are optional.
- **Privacy practices** — the part that gets submissions rejected. Suggested
  answers:
  - *Single purpose*: "Replaces the word 'AI' with 'LLM' in the text of pages
    the user reads."
  - *Justification for `storage`*: "Stores the user's own list of word
    substitutions, a few short pairs of text, on the device, so the same map
    applies on every page they read."
  - *Data collection*: none. Nothing is read from the page except the text being
    rewritten, and nothing is sent anywhere.
  - *Remote code*: none. Everything ships in the archive.

## addons.mozilla.org

- **Upload** the `-firefox.zip`. AMO signs it; an unsigned archive is what you
  submit.
- **Registration** is free.
- **Listing**: name, summary (250 characters), description, category, and the
  licence — MIT, which is in the repository.
- **Data collection** is already declared in the manifest as
  `browser_specific_settings.gecko.data_collection_permissions: { required:
  ["none"] }`, which AMO requires of new extensions. That declaration is why
  `strict_min_version` is 140 (and 142 for Firefox for Android) rather than
  something older.
- **Source code**: AMO's reviewers must be able to read what you ship. The
  bundle is esbuild output with no minification, so it reads as ordinary
  JavaScript, but expect the "do you use a build tool?" question. Answer yes and
  point at this repository; `pnpm build` reproduces `dist/` exactly.

## The map never leaves the machine

The map is stored with `storage.local`, so it stays on the device. Nothing the
user reads and nothing they configure is sent anywhere by the extension, which
makes "collects nothing" the plain description rather than a careful one.

The cost is that the map does not follow them between machines. If that trade
ever looks wrong, `storage.sync` is a one-line change in `src/browser.ts` and
`src/storage.ts` — but then their rule list travels through their browser
account, which is a stranger thing to do quietly.

## Still to be made

- **Screenshots.** Both stores want them and neither accepts an SVG. They should
  be taken from a real page with the extension running, which is a job for a
  browser and a human eye rather than for a build script.
- **The promo tile and marquee**, if you want them.
