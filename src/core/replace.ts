/**
 * The pure heart of the extension: a string in, the corrected string out. No
 * DOM, no storage, no browser — so it is cheap to test and easy to reason about.
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

/** Characters that mean something in a regular expression but must be literal here. */
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

interface CompiledRule {
  from: string;
  to: string;
  pattern: RegExp;
}

const patternCache = new Map<string, readonly CompiledRule[]>();

function compile(rules: readonly Rule[]): readonly CompiledRule[] {
  // Keyed on both fields, and JSON-encoded so that no combination of `from` and
  // `to` can collide with another: two rules that share a `from` but differ in
  // `to` are different entries.
  const key = JSON.stringify(rules.map((rule) => [rule.from, rule.to]));
  let compiled = patternCache.get(key);

  if (compiled === undefined) {
    compiled = rules.map((rule) => {
      const literal = rule.from.replace(REGEX_META, "\\$&");
      return {
        ...rule,
        pattern: new RegExp(`${NOT_WORD_BEFORE}${literal}${NOT_WORD_AFTER}`, "g"),
      };
    });
    patternCache.set(key, compiled);
  }

  return compiled;
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
 * Apply every rule, in order, to `text`.
 *
 * Rules are literal and each one sees the previous one's output, so a map like
 * `AI → LLM` plus `LLM → large language model` would chain. Nothing in the
 * default map chains, and the content script only writes when the result
 * differs, which is what keeps a re-render from looping.
 */
export function replaceText(text: string, rules: readonly Rule[] = DEFAULT_RULES): string {
  if (!mayChange(text, rules)) return text;

  let out = text;
  for (const { from, to, pattern } of compile(rules)) {
    if (!out.includes(from)) continue;
    // A replacer function, not a replacement string, so that "$&" and friends
    // in a rule's `to` are written literally instead of being interpreted.
    out = out.replace(pattern, () => to);
  }
  return out;
}
