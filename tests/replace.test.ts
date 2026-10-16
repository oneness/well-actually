import { describe, expect, it } from "vitest";

import { mayChange, replaceText, splitText } from "../src/core/replace";
import { DEFAULT_RULES, type Rule } from "../src/core/rules";

const SWAP: readonly Rule[] = [{ from: "AI", to: "LLM" }];

describe("replaceText", () => {
  it("replaces a whole word", () => {
    expect(replaceText("AI is coming", SWAP)).toBe("LLM is coming");
  });

  it("replaces every occurrence", () => {
    expect(replaceText("AI, AI, and AI again", SWAP)).toBe("LLM, LLM, and LLM again");
  });

  describe("leaves substrings alone", () => {
    for (const word of ["said", "air", "AIDS", "captain", "Mumbai", "Chiang Mai"]) {
      it(word, () => {
        expect(replaceText(word, SWAP)).toBe(word);
      });
    }
  });

  it("leaves a different capitalisation alone", () => {
    expect(replaceText("Ai Weiwei", SWAP)).toBe("Ai Weiwei");
  });

  it("is case-sensitive, so a lowercase rule is its own entry", () => {
    const lower: readonly Rule[] = [{ from: "ai", to: "llm" }];
    expect(replaceText("ai is a hot startup", lower)).toBe("llm is a hot startup");
    expect(replaceText("AI is a hot startup", lower)).toBe("AI is a hot startup");
  });

  describe("boundaries around punctuation", () => {
    const cases: readonly [string, string][] = [
      ["AI-powered", "LLM-powered"],
      ["(AI)", "(LLM)"],
      ["AI.", "LLM."],
      ['"AI"', '"LLM"'],
      ["AI's", "LLM's"],
      ["the AI, or the AI:", "the LLM, or the LLM:"],
      ["AI\nnext line", "LLM\nnext line"],
      ["—AI—", "—LLM—"],
      ["AI2", "AI2"],
      ["2AI", "2AI"],
      ["_AI_", "_AI_"],
    ];

    for (const [input, expected] of cases) {
      it(JSON.stringify(input), () => {
        expect(replaceText(input, SWAP)).toBe(expected);
      });
    }
  });

  it("returns text that matches nothing unchanged", () => {
    const text = "Nothing to see here.";
    expect(replaceText(text, SWAP)).toBe(text);
  });

  it("handles the empty string", () => {
    expect(replaceText("", SWAP)).toBe("");
  });

  it("does not let one rule rewrite another rule's output", () => {
    const map: readonly Rule[] = [
      { from: "AI", to: "LLM" },
      { from: "LLM", to: "large language model" },
    ];
    expect(replaceText("AI", map)).toBe("LLM");
  });

  it("prefers the longest matching rule", () => {
    const map: readonly Rule[] = [
      { from: "AI", to: "LLM" },
      { from: "AI models", to: "LLMs" },
    ];
    expect(replaceText("AI models", map)).toBe("LLMs");
    expect(replaceText("AI model", map)).toBe("LLM model");
  });

  it("prefers the longest rule whichever order the map is written in", () => {
    const rules: readonly Rule[] = [
      { from: "AI models", to: "LLMs" },
      { from: "AI", to: "LLM" },
    ];
    expect(replaceText("AI models", rules)).toBe("LLMs");
  });

  it("treats regex metacharacters in a rule as literal text", () => {
    const rules: readonly Rule[] = [{ from: "a.b", to: "x" }];
    expect(replaceText("a.b", rules)).toBe("x");
    expect(replaceText("axb", rules)).toBe("axb");
  });

  it("treats dollar signs in a replacement as literal text", () => {
    const rules: readonly Rule[] = [{ from: "AI", to: "$& $$$1" }];
    expect(replaceText("AI", rules)).toBe("$& $$$1");
  });

  it("replaces text in a rule whose match contains punctuation", () => {
    const rules: readonly Rule[] = [{ from: "AI-powered", to: "LLM-powered" }];
    expect(replaceText("an AI-powered toaster", rules)).toBe("an LLM-powered toaster");
  });

  it("does not touch a rule's own replacement when re-applied", () => {
    const once = replaceText("AI agents everywhere", SWAP);
    expect(replaceText(once, SWAP)).toBe(once);
  });

  it("uses the built-in map by default", () => {
    expect(replaceText("AI everywhere")).toBe("LLM everywhere");
    expect(DEFAULT_RULES).toEqual([{ from: "AI", to: "LLM" }]);
  });
});

describe("splitText", () => {
  it("marks only the pieces a rule claimed", () => {
    expect(splitText("An AI toaster", SWAP)).toEqual([
      { text: "An " },
      { text: "LLM", original: "AI" },
      { text: " toaster" },
    ]);
  });

  it("returns one untouched piece when nothing matches", () => {
    expect(splitText("nothing here", SWAP)).toEqual([{ text: "nothing here" }]);
  });

  it("accounts for the whole string, joined back up", () => {
    const text = "AI and AI-powered and AI.";
    expect(splitText(text, SWAP).map((piece) => piece.text).join("")).toBe(replaceText(text, SWAP));
  });

  it("gives every rewritten piece exactly one original", () => {
    const rewritten = splitText("AI, AI", SWAP).filter((piece) => piece.original !== undefined);
    expect(rewritten).toEqual([
      { text: "LLM", original: "AI" },
      { text: "LLM", original: "AI" },
    ]);
  });
});

describe("mayChange", () => {
  it("is true when a rule could match", () => {
    expect(mayChange("an AI thing", SWAP)).toBe(true);
  });

  it("is false when no rule could match", () => {
    expect(mayChange("a boring sentence", SWAP)).toBe(false);
  });

  it("is advisory: it does not apply boundaries", () => {
    expect(mayChange("AIDS", SWAP)).toBe(true);
    expect(replaceText("AIDS", SWAP)).toBe("AIDS");
  });

  it("is case-sensitive", () => {
    expect(mayChange("said", SWAP)).toBe(false);
    expect(mayChange("air", SWAP)).toBe(false);
  });
});
