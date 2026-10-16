/**
 * The substitution map: what Well, Actually changes, and what it changes it to.
 *
 * A rule holds two literal strings. There is deliberately no regex, no flags
 * object, and no per-rule options: every rule matches the same way (whole word,
 * exact case), so there is only ever one thing to explain.
 */
export interface Rule {
  /** Literal text to find, e.g. `AI`. */
  from: string;
  /** Literal text to write in its place, e.g. `LLM`. */
  to: string;
}

/**
 * The built-in map — what the extension does before you configure anything.
 *
 * One rule, on purpose. "AI" is almost always a large language model or a
 * product wrapped around one, and the whole point of the extension is to stop
 * letting the larger word do the marketing's work. The options page offers
 * more, but this is what an unconfigured install does.
 *
 * Matching is case-sensitive, so "Ai Weiwei" survives untouched. A second
 * capitalisation would need its own rule.
 */
export const DEFAULT_RULES: readonly Rule[] = [{ from: "AI", to: "LLM" }];
