/**
 * The built-in maps the options page offers, as a starting point to edit rather
 * than a mode to be in. Picking one fills the form; nothing changes until it is
 * saved.
 */

import { DEFAULT_RULES, type Rule } from "./rules";

export interface Preset {
  id: string;
  name: string;
  /** What this map claims, in one sentence, for the options page. */
  summary: string;
  rules: readonly Rule[];
}

/**
 * Every replacement starts with a sound of the same kind as the text it
 * replaces — "AI" takes "an", and so does "LLM" — because a map cannot see the
 * article in front of it and would otherwise produce "an chatbot". That
 * constraint is what keeps these maps to noun phrases that slot back into the
 * same sentence, and it is why this is a list of corrections rather than a set
 * of expansions: "AI agent" cannot become "a chatbot with tools" without
 * breaking the sentence it lands in.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: "blunt",
    name: "Blunt",
    summary: 'Every "AI" becomes "LLM". One rule, occasionally wrong, and what an unconfigured install does.',
    rules: DEFAULT_RULES,
  },
  {
    id: "strict",
    name: "Strict",
    summary:
      'Blunt, plus the places where "LLM <noun>" stutters, and the marketing nouns that mean "language model".',
    rules: [
      ...DEFAULT_RULES,
      // "an LLM model" is a stutter; an AI model is a model.
      { from: "AI models", to: "LLMs" },
      { from: "AI model", to: "LLM" },
      // Not a new species: a language model with a longer scratchpad or a bigger bill.
      { from: "frontier models", to: "language models" },
      { from: "frontier model", to: "language model" },
      { from: "foundation models", to: "language models" },
      { from: "foundation model", to: "language model" },
      { from: "reasoning models", to: "language models" },
      { from: "reasoning model", to: "language model" },
    ],
  },
];
