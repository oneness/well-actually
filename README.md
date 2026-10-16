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
- The longest phrase wins, so `AI models → LLMs` is never swallowed by
  `AI → LLM`, whichever order you write them in.
- Keeps up with pages that render after load — SPAs, infinite scroll, lazily
  inserted articles — including pages that throw away their own `<body>`.
- Leaves alone the places where an edit would be wrong or rude: code samples
  (`<pre>`, `<code>`), text fields, `contenteditable` editors, `<script>`,
  `<style>`, and `<select>`.
- The map is yours: an options page edits it, stored with `browser.storage.sync`.
- Optionally, hovering a correction shows what the page actually said.

It asks for one permission, `storage`, and nothing else. It reads the page; it
does not talk to anything.

## Installing it before it is published

Build it first (`pnpm build`), then:

- **Chrome** — `chrome://extensions`, turn on Developer mode, *Load unpacked*,
  choose `dist/`.
- **Firefox** — `about:debugging#/runtime/this-firefox`, *Load Temporary
  Add-on*, choose `dist/manifest.json`. This lasts until Firefox restarts.

The options page is in the extensions menu, under *Options*, in both.

### Keeping it in Firefox while you dogfood it

A temporary add-on is gone after a restart, which is no good for reading with.
`pnpm package` also writes `artifacts/well-actually-<version>.xpi` for a real
install. In Developer Edition, open `about:addons`, use the gear icon's
*Install Add-on From File…*, and pick that file — or drag it onto the page.

That works unsigned for two reasons, both of which are worth knowing:

- Developer Edition ships `pref("xpinstall.signatures.required", false)`, so it
  does not check signatures at all. Release Firefox does, and there the only
  answer is to get the archive signed by addons.mozilla.org.
- An install you started yourself is not a sideload, so Firefox leaves it
  enabled.

Copying the same file into
`<profile>/extensions/well-actually@oneness.github.io.xpi` also installs it, and
that is the scriptable version — but Firefox auto-disables anything it finds
there on its own. It appears as installed and switched off, with nothing in the
UI explaining why. The pref behind that is:

```
about:config → extensions.autoDisableScopes → 0
```

Two more things worth knowing while dogfooding: re-installing a build with the
same version number may not take, so bump `version` in `package.json` if a change
seems to have gone missing; and `pnpm exec web-ext run --source-dir dist` starts
Firefox with the extension in it and reloads as you rebuild, which is the faster
loop while the code is still moving.

## The map

The default is one rule, in [`src/core/rules.ts`](src/core/rules.ts):

```ts
export const DEFAULT_RULES: readonly Rule[] = [{ from: "AI", to: "LLM" }];
```

One rule, on purpose. "AI" is almost always a large language model or a product
wrapped around one, and the point of the extension is to stop letting the larger
word do the marketing's work.

Everything else is in the options page, which is the whole configuration
surface: a list of literal `from`/`to` pairs, no regex and no per-rule options.
Four things are worth knowing before you write one.

- **Whole words, exact case.** A second capitalisation is a second rule.
- **The longest phrase wins.** Ties go to the rule written first.
- **An empty replacement deletes the word.**
- **A correction is never corrected again.** The map is a set of corrections,
  not a pipeline, so `AI → LLM` plus `LLM → large language model` leaves you
  with `LLM`. Without that, two rules could chase each other around a page.

Changing the map applies to pages you load from then on; a tab that is already
open keeps the map it started with until you reload it.

## Presets, and why they are not "registers"

The options page offers two maps to start from. **Blunt** is the default above.
**Strict** adds the places where the blunt swap produces clumsy English
(`AI model → LLM`, so you do not get "an LLM model") and the marketing nouns
that are just language models wearing a tie (`frontier model`,
`foundation model`, `reasoning model`).

There is no preset that *expands* — that turns `AI agent` into `a chatbot with
tools`, which is the more satisfying correction, and it cannot be done. A map
is literal: it cannot see the article in front of the phrase it replaces, so
"an AI agent" would become "an **an** chatbot" or "an **a** chatbot with tools".

The reason `AI → LLM` works so cleanly is the same reason. "AI" is pronounced
with a vowel sound and so is "LLM", so the "an" in front of it survives the
swap. Every replacement has to start with a sound of the same kind as the text
it replaces, which is why these maps are noun phrases that slot back into the
same sentence rather than explanations of what the thing is.

So the honest register is the one you write yourself, in the options page. That
is what it is for.

## Hover to reveal

A correction can show the original wording on hover, which is the feature that
makes the extension trustworthy rather than merely confident. The tooltip reads
`original: AI`; the wording is one string in `static/content.css` if you want it
to say something else.

It appears immediately, and it is generated content rather than an element. That
matters twice over. A native `title` tooltip cannot say what it is showing and
waits about a second before it appears, and an element holding this wording
would be found and rewritten by the extension itself — the tooltip for a
correction of "AI" contains "AI".

It is off by default, because it has to wrap each correction in a `<span>`: a
real element appearing in the page. A site that lays its text out as flex or
grid items will notice one appearing, and its own CSS may style it. Two smaller
consequences: the tooltip is positioned by the page's own layout, so a container
with `overflow: hidden` can clip it, and the reveal is a pointer affordance — a
screen reader gets the corrected text and no tooltip.

Turning it on is a fair trade if you want to check what a page really said;
leaving it off is the safe default.

## Development

The toolchain comes from the flake, so the Node and Playwright versions are the
same everywhere:

```sh
nix develop
pnpm install
pnpm check        # typecheck, unit tests, build, and a Firefox manifest lint
pnpm test:e2e     # Playwright, loading the built extension into Chromium
pnpm check:firefox  # loads the built extension into a real Firefox
```

`pnpm check` finishes with `web-ext lint` over `dist/`, so the manifest is
checked against what addons.mozilla.org will accept before it is ever uploaded.

`pnpm test:e2e` opens a real (non-headless) Chromium, because Chromium does not
load extensions without one. Inside `nix develop` the browsers come from
nixpkgs, so do not run `playwright install`.

`pnpm check:firefox` is separate because it needs a real Firefox on the machine
(`FIREFOX=/path/to/firefox` to choose one; by default it looks for `firefox`,
then `firefox-devedition`) and because Playwright cannot drive stock Firefox with
an extension loaded. It installs the packaged XPI into a throwaway profile and
launches Firefox headlessly, and the fixture page reports its own text back to
the fixture server — so the check covers the thing that fails silently on
Firefox: if `storage.sync` were unavailable, reading the settings would reject,
the content script would never sweep, and every page would look untouched. It is
the same install a dogfooding profile gets, so a broken XPI fails here first.

- `src/core/` — pure functions, no DOM. `replaceText` and `splitText` are the
  whole product, and `tests/replace.test.ts` is the argument that they are
  correct.
- `src/content.ts` — the DOM half: walk the page, rewrite text nodes, watch for
  changes. `tests/e2e/` is the argument that the DOM half agrees.
- `src/options.ts` — the options page. It reads and writes the settings record
  through the same validation the content script uses.

## Packaging

```sh
pnpm package        # artifacts/well-actually-<version>-{chrome,firefox}.zip
pnpm check:package  # verifies those archives, and loads the Chrome one into Chromium
```

Ten files each, `manifest.json` at the root, no source maps. The archives are
byte-for-byte reproducible, so a published file can be regenerated from the tag
it was built at. The Chrome archive has `browser_specific_settings` removed,
because Chrome warns about keys it cannot use and that warning would sit in
front of a reviewer.

`pnpm check:package` tests the archives rather than the directory they came
from, which is the point: the archive is what gets uploaded.

What to fill in at each store, and what is still missing, is in
[docs/submission.md](docs/submission.md).

## Not built yet

- Screenshots for the two listings, which want a browser and an eye rather than
  a build script.
- The e2e suite in CI, which needs xvfb for the headed Chromium.
- A switch to turn the extension off for one site, for the pages where you do
  want to read about AI.
- More presets. The article-sound constraint above is the thing to keep in mind
  when writing one.

## License

MIT.
