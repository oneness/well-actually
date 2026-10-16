# Well, Actually

A browser extension (Chrome + Firefox, Manifest V3) that replaces the word "AI"
with "LLM" in page text as the reader sees it.

## Shape of the repository

- `src/core/` — pure TypeScript, no DOM and no browser APIs. `replaceText` is
  the product; everything else is plumbing around it.
- `src/content.ts` — the only code that touches the page.
- `static/` — `manifest.json` and anything else copied verbatim into `dist/`.
- `tests/replace.test.ts` — vitest, the pure functions.
- `tests/e2e/` — Playwright, loading the built extension into Chromium against
  the fixture pages in `tests/fixtures/`.
- `build.mjs` — esbuild, one bundle plus a versioned manifest copy.

## Rules for changes

- **Keep the decision in `src/core/`.** Any behaviour that can live in a pure
  function must, and must have a unit test. `src/content.ts` should only ever
  decide *which* text nodes to hand to the core.
- **Readability of the reading experience is the product.** A change that
  rewrites something it should not have — a name, a code sample, someone's
  draft — is a worse bug than a change that misses one.
- **Never write to a node unless the text actually changed.** That conditional
  write is the entire reason the mutation observer terminates instead of
  looping, and it is the reason re-running a pass is safe.
- **One way to do each thing.** The rule type has two fields and no options on
  purpose. Do not add a regex mode, a flags object, or a per-site override
  without removing the thing it replaces.
- **No permissions without a reason.** The extension now asks for none. A new
  permission needs to be justified in the README next to what it buys.
- **Verify before claiming success.** `pnpm check` must pass (it builds and lints
  the manifest against AMO's rules), and a change to the DOM half needs
  `pnpm test:e2e`.
- **Never hand-edit `static/manifest.json`'s `version`.** `build.mjs` stamps it
  from `package.json`.

## Environment

Use `nix develop`. It supplies Node, pnpm, and — on Linux — the Playwright
browser bundle from nixpkgs, so `pnpm test:e2e` works without
`playwright install` and without a version drift between the two.

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
