import { describe, expect, it } from "vitest";

import { PRESETS } from "../src/core/presets";
import { replaceText } from "../src/core/replace";
import { normalizeSettings } from "../src/core/settings";
import type { Rule } from "../src/core/rules";

function preset(id: string): readonly Rule[] {
  const found = PRESETS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found.rules;
}

describe("presets", () => {
  it("has a unique id each", () => {
    const ids = PRESETS.map((candidate) => candidate.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("describes itself in the options page", () => {
    for (const candidate of PRESETS) {
      expect(candidate.name).not.toBe("");
      expect(candidate.summary).not.toBe("");
    }
  });

  it("holds only rules the schema would keep", () => {
    for (const candidate of PRESETS) {
      const stored = normalizeSettings({ rules: [...candidate.rules], reveal: false });
      expect(stored.rules).toEqual(candidate.rules);
    }
  });

  it("blunt swaps the word and nothing else", () => {
    expect(replaceText("An AI model arrived.", preset("blunt"))).toBe("An LLM model arrived.");
  });

  it("strict fixes the stutter blunt leaves behind", () => {
    expect(replaceText("An AI model arrived.", preset("strict"))).toBe("An LLM arrived.");
    expect(replaceText("Two AI models arrived.", preset("strict"))).toBe("Two LLMs arrived.");
  });

  it("strict says what the marketing nouns are", () => {
    expect(replaceText("A foundation model is a frontier model.", preset("strict"))).toBe(
      "A language model is a language model.",
    );
  });

  it("leaves the article in front of a replacement grammatical", () => {
    // Every replacement starts with a sound of the same kind as the text it
    // replaces, so "an" stays correct. A map cannot see the article, so this is
    // the constraint that keeps its rules usable.
    expect(replaceText("an AI model", preset("strict"))).toBe("an LLM");
    expect(replaceText("an AI agent", preset("strict"))).toBe("an LLM agent");
    expect(replaceText("a frontier model", preset("strict"))).toBe("a language model");
    expect(replaceText("a reasoning model", preset("strict"))).toBe("a language model");
  });
});
