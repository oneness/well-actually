# Well, Actually

A browser extension for Chrome and Firefox that replaces **AI** with **LLM** as
you read.

> We're an AI company. → We're an LLM company.

"AI" is a marketing word. The thing it usually points at is a large language
model, or a product wrapped around one, or a spreadsheet with a regression in
it. This extension does the smallest possible thing about that: it edits the
page while you read it, so the sentence says what it means.

It is not a gag. [Cloud to Butt][c2b] and [ai-to-butt][a2b] already do the gag,
and the joke wears off in a day. This one is meant to be left on.

[c2b]: https://chromewebstore.google.com/detail/cloud-to-butt/ginlolbenmkfpbilldmemhbjegccpbn
[a2b]: https://chromewebstore.google.com/detail/ai-to-butt/npaglkhfpoakfebkkomapklcnojpmoel

## What it does

- Replaces `AI` with `LLM` in the page's visible text, as it renders.
- Whole words only: `said`, `air`, `AIDS`, and `captain` are left alone, while
  `AI-powered` becomes `LLM-powered` and `AI's` becomes `LLM's`.
- Case-sensitive: `Ai Weiwei` is not a language model.
- Keeps up with pages that render after load — SPAs, infinite scroll, lazily
  inserted articles.
- Leaves alone the places where an edit would be wrong or rude: code samples
  (`<pre>`, `<code>`), text fields, `contenteditable` editors, `<script>`,
  `<style>`, and `<select>`.
- Asks for **no permissions at all**. It reads the page, it does not talk to
  anything.

## Installing it before it is published

Build it first (`pnpm build`), then:

- **Chrome** — `chrome://extensions`, turn on Developer mode, *Load unpacked*,
  choose `dist/`.
- **Firefox** — `about:debugging#/runtime/this-firefox`, *Load Temporary
  Add-on*, choose `dist/manifest.json`.

## The map

Everything the extension does is one list of rules in
[`src/core/rules.ts`](src/core/rules.ts):

```ts
export const DEFAULT_RULES: readonly Rule[] = [{ from: "AI", to: "LLM" }];
```

One rule, on purpose. `from` and `to` are literal strings — there is no regex
and no per-rule options, because a correction should not need a manual. A rule
matches a whole word, case-sensitively; if you also want the lowercase `ai`,
that is a second rule.

A page for editing and storing your own rules is the next thing to be built.

## Development

The toolchain comes from the flake, so the Node and Playwright versions are the
same everywhere:

```sh
nix develop
pnpm install
pnpm check       # typecheck, unit tests, build, and a Firefox manifest lint
pnpm test:e2e    # Playwright, loading the built extension into Chromium
```

`pnpm check` finishes with `web-ext lint` over `dist/`, so the manifest is
checked against what addons.mozilla.org will accept before it is ever uploaded.

`pnpm test:e2e` opens a real (non-headless) Chromium, because Chromium does not
load extensions without one. Inside `nix develop` the browsers come from
nixpkgs, so do not run `playwright install`.

- `src/core/` — pure functions, no DOM. `replaceText(text, rules)` is the whole
  product, and `tests/replace.test.ts` is the argument that it is correct.
- `src/content.ts` — the DOM half: walk the page, rewrite text nodes, watch for
  changes. `tests/e2e/` is the argument that the DOM half agrees.

## Not built yet

- An options page to edit the map, stored with `browser.storage.sync`.
- A second register of rules that expands rather than renames — `AI agent` →
  `a chatbot with tools`, `AGI` → `???`. The blunt `AI → LLM` swap is honest
  most of the time, not all of the time.
- A way to see what was changed: hover to reveal the original wording.
- Icons. The extension currently loads with the browser's generic one.
- Packaging for the Chrome Web Store and addons.mozilla.org, and e2e in CI.

## License

MIT.
