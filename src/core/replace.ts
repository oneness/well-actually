/**
 * The pure heart of the extension: a string in, corrected pieces out. No DOM,
 * no storage, no browser — so it is cheap to test and easy to reason about.
 */

import { DEFAULT_RULES, type Rule } from "./rules";

/**
 * What counts as part of a word when deciding whether a match stands alone.
 * `AI` must survive inside `AI-powered` but not inside `said`, `air`, or `AIDS`
 * — which is exactly "not adjacent to a word character". Lookarounds are used
 * instead of `\b` so a rule containing punctuation (`AI-powered`) still lands
 * its boundaries where a person would expect.
 */
const NOT_WORD_BEFORE = "(?<![A-Za-z0-9_])";
const NOT_WORD_AFTER = "(?![A-Za-z0-9_])";

/**
 * A dotted token is a name rather than prose. `Bancs.AI` is a domain and
 * `AI.pdf` is a file; neither should be edited, and the first is the reason this
 * exists.
 *
 * The two sides are not symmetric, because a full stop means different things in
 * front of a word and behind it. A dot *before* a match always means a dotted
 * token, since prose does not end a sentence and start the next word without a
 * space. A dot *behind* one usually means the sentence ended — `AI.` — and only
 * means a token when a word character follows it, as in `AI.com`.
 */
const NOT_DOTTED_BEFORE = "(?<!\\.)";
const NOT_DOTTED_AFTER = "(?!\\.[A-Za-z0-9_])";

/** Characters that mean something in a regular expression but must be literal here. */
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

/**
 * A stretch of text: either as the page wrote it, or as a rule rewrote it.
 * `original` is set only on pieces a rule claimed, and is the wording that
 * reveal-on-hover gives back.
 */
export interface Piece {
  text: string;
  original?: string;
}

interface Matcher {
  /** Rules in the order their alternatives appear in `pattern`. */
  ordered: readonly Rule[];
  pattern: RegExp;
}

const matcherCache = new Map<string, Matcher>();

function matcher(rules: readonly Rule[]): Matcher {
  // Keyed on both fields, and JSON-encoded so that no combination of `from` and
  // `to` can collide with another: two rules that share a `from` but differ in
  // `to` are different entries.
  const key = JSON.stringify(rules.map((rule) => [rule.from, rule.to]));
  let found = matcherCache.get(key);

  if (found === undefined) {
    // Longest `from` first, so a phrase rule wins over a shorter rule starting
    // at the same place — "AI models" beats "AI". Equal lengths keep the order
    // the map was written in.
    const ordered = [...rules].sort((a, b) => b.from.length - a.from.length);
    const source = ordered
      .map((rule, index) => {
        const literal = rule.from.replace(REGEX_META, "\\$&");
        return `(?<m${index}>${NOT_WORD_BEFORE}${NOT_DOTTED_BEFORE}${literal}${NOT_WORD_AFTER}${NOT_DOTTED_AFTER})`;
      })
      .join("|");

    found = { ordered, pattern: new RegExp(source, "g") };
    matcherCache.set(key, found);
  }

  return found;
}

/** Which rule's alternative the engine landed on. */
function ruleFor(match: RegExpExecArray, ordered: readonly Rule[]): Rule | undefined {
  for (let index = 0; index < ordered.length; index++) {
    if (match.groups?.[`m${index}`] !== undefined) return ordered[index];
  }
  return undefined;
}

/**
 * Whether any rule could match somewhere in `text`. Cheap enough to run across
 * every text node on a page, which is what lets the content script skip the
 * regex work entirely on the vast majority of nodes.
 */
export function mayChange(text: string, rules: readonly Rule[] = DEFAULT_RULES): boolean {
  return rules.some((rule) => text.includes(rule.from));
}

/**
 * Cut `text` into the pieces a rule claims and the pieces it leaves alone.
 *
 * Each spot in the text is claimed at most once: the map is a set of
 * corrections, not a pipeline, so a rule never rewrites another rule's output.
 * That is what makes the result predictable, and it is what makes
 * reveal-on-hover unambiguous — every rewritten piece has exactly one original.
 */
export function splitText(text: string, rules: readonly Rule[] = DEFAULT_RULES): Piece[] {
  if (!mayChange(text, rules)) return [{ text }];

  const { ordered, pattern } = matcher(rules);
  const pieces: Piece[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const rule = ruleFor(match, ordered);
    if (rule === undefined) continue;

    const start = match.index ?? cursor;
    if (start > cursor) pieces.push({ text: text.slice(cursor, start) });
    pieces.push({ text: rule.to, original: match[0] });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) pieces.push({ text: text.slice(cursor) });
  return pieces;
}

/**
 * Apply the map to `text`. `splitText` with the pieces joined back up, which
 * keeps one engine behind both the plain rewrite and the hovering reveal.
 */
export function replaceText(text: string, rules: readonly Rule[] = DEFAULT_RULES): string {
  return splitText(text, rules)
    .map((piece) => piece.text)
    .join("");
}
