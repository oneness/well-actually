# Well, Actually

A browser extension (Chrome + Firefox, Manifest V3) that replaces the word "AI"
with "LLM" in page text as the reader sees it.

## Shape of the repository

- `src/core/` — pure TypeScript, no DOM and no browser APIs. `splitText` is the
  engine and `replaceText` is its join; everything else is plumbing around them.
  - `rules.ts` — the `Rule` type and the built-in map.
  - `settings.ts` — the `Settings` record and the validation that guards it.
  - `presets.ts` — the maps the options page offers.
- `src/content.ts` — the only code that touches the page.
- `src/options.ts` — the options page.
- `src/browser.ts` — the `browser`/`chrome` shim, and the only hand-written
  declaration of a browser API.
- `src/storage.ts` — the trip to `storage.sync`, with no opinions of its own.
- `static/` — `manifest.json`, the options page, `content.css`, icons, and
  anything else copied verbatim into `dist/`.
- `tests/` — vitest for the pure functions, Playwright for the DOM half,
  `tests/fixtures/` for the pages both run against.
- `scripts/check-firefox.sh` — installs the packaged XPI into a throwaway
  Firefox profile and checks a page gets rewritten.
- `scripts/check-package.sh` — verifies the store archives themselves, and runs
  the Firefox check against the XPI.
- `build.mjs` — esbuild, two bundles plus a versioned manifest copy.
- `package.mjs` — the two store archives, written by hand so the toolchain has
  no packaging dependency and the output stays reproducible.

## Rules for changes

- **Keep the decision in `src/core/`.** Any behaviour that can live in a pure
  function must, and must have a unit test. `src/content.ts` should only ever
  decide *which* text nodes to hand to the core.
- **Readability of the reading experience is the product.** A change that
  rewrites something it should not have — a name, a code sample, someone's
  draft — is a worse bug than a change that misses one.
- **Never write to a node unless the text actually changed, and never rewrite
  our own output.** The `written` WeakMap in `src/content.ts` is load-bearing:
  without it the map behaves one way in the pure engine and another way in the
  page, and reveal-on-hover spans get walked and rewritten. Do not remove it
  without a test that a two-rule map still settles.
- **A rule is two literal strings.** No regex mode, no flags object, no
  per-site overrides. Adding one of those means removing something it replaces.
- **New rules and presets must keep the article in front of them grammatical.**
  A replacement has to begin with a sound of the same kind as the text it
  replaces — "AI" and "LLM" both take "an" — because a map cannot see the
  article. This is why presets hold noun phrases and not explanations. There is
  a test for it in `tests/presets.test.ts`; keep it.
- **Nothing read from storage is trusted.** It outlives upgrades and is editable
  by hand, so it goes through `normalizeSettings` before it reaches a page.
- **No permissions without a reason.** `storage` is the only one, and it buys
  the options page. A second needs justifying in the README.
- **Verify before claiming success.** `pnpm check` must pass (it builds and lints
  the manifest against AMO's rules), a change to the DOM half needs
  `pnpm test:e2e`, a change to how the extension starts up needs
  `pnpm check:firefox`, and anything being released needs `pnpm check:package`.
- **Never hand-edit `static/manifest.json`'s `version`.** `build.mjs` stamps it
  from `package.json`.
- **Keep the archives reproducible.** The pinned DOS timestamp in `package.mjs`
  is deliberate: it is what lets a published archive be checked against the tag
  it came from. Do not introduce a timestamp or a random ordering.
- **Test a packaged artifact, not just `dist/`.** The e2e suite reads
  `WA_EXTENSION_DIR`, which is how `scripts/check-package.sh` runs the whole
  suite against the extracted Chrome archive.

## Environment

Use `nix develop`. It supplies Node, pnpm, and — on Linux — the Playwright
browser bundle from nixpkgs, so `pnpm test:e2e` works without
`playwright install` and without a version drift between the two.

`pnpm check:firefox` and `pnpm check:package` also want a real Firefox on the
machine. They look for `firefox`, then `firefox-devedition`, and take
`FIREFOX=/path/to/firefox` if neither is the one you want.

## Dogfooding

The install a developer uses is the install `scripts/check-firefox.sh` performs:
the packaged XPI in a profile's `extensions/` directory, plus
`extensions.autoDisableScopes = 0`, because Firefox switches off anything it
finds there by itself. Installing through `about:addons` instead avoids the pref,
because an install you started is not a sideload. The README explains both.

## Icons

`static/icons/icon.svg` is the source. The PNGs next to it are generated from
that file and committed, because Chrome will not accept an SVG icon. After
editing the SVG:

```sh
for size in 16 32 48 128; do
  nix run nixpkgs#librsvg -- -w $size -h $size \
    -o static/icons/icon-$size.png static/icons/icon.svg
done
```

Do not hand-edit the PNGs.
