import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings } from "../src/core/settings";

describe("normalizeSettings", () => {
  it("gives the built-in map when nothing has been stored", () => {
    expect(normalizeSettings(undefined)).toEqual({ rules: [{ from: "AI", to: "LLM" }], reveal: true });
  });

  describe("falls back to the built-in map when the record is not usable", () => {
    for (const value of [null, 42, "settings", true, [], {}, { rules: "AI" }, { rules: {} }]) {
      it(JSON.stringify(value) ?? "undefined", () => {
        expect(normalizeSettings(value)).toEqual(DEFAULT_SETTINGS);
      });
    }
  });

  it("keeps an empty map, because deleting every rule is a real choice", () => {
    expect(normalizeSettings({ rules: [], reveal: false })).toEqual({ rules: [], reveal: false });
  });

  it("keeps rules in the order they were stored", () => {
    const rules = [
      { from: "frontier model", to: "language model" },
      { from: "AI", to: "LLM" },
    ];
    expect(normalizeSettings({ rules, reveal: false }).rules).toEqual(rules);
  });

  it("keeps a rule that replaces with nothing, which deletes the word", () => {
    const rules = [{ from: "AI", to: "" }];
    expect(normalizeSettings({ rules, reveal: false }).rules).toEqual(rules);
  });

  describe("drops rules that could never do anything", () => {
    const cases: readonly [string, unknown[]][] = [
      ["a rule that is not an object", ["AI", null, 7, []]],
      ["a rule with no find value", [{ to: "LLM" }]],
      ["a rule with no replacement", [{ from: "AI" }]],
      ["a find value that is not text", [{ from: 7, to: "LLM" }]],
      ["a replacement that is not text", [{ from: "AI", to: null }]],
      ["a find value that is empty", [{ from: "", to: "LLM" }]],
    ];

    for (const [name, rules] of cases) {
      it(name, () => {
        expect(normalizeSettings({ rules, reveal: false }).rules).toEqual([]);
      });
    }
  });

  it("keeps the good rules when some are junk", () => {
    const rules = [{ from: "AI", to: "LLM" }, { from: "" }, null, { from: "AGI", to: "???" }];
    expect(normalizeSettings({ rules, reveal: false }).rules).toEqual([
      { from: "AI", to: "LLM" },
      { from: "AGI", to: "???" },
    ]);
  });

  describe("reveal", () => {
    it("is on by default, because it is what makes a correction checkable", () => {
      expect(DEFAULT_SETTINGS.reveal).toBe(true);
    });

    it("is the user's answer when they have given one", () => {
      expect(normalizeSettings({ rules: [], reveal: true }).reveal).toBe(true);
      expect(normalizeSettings({ rules: [], reveal: false }).reveal).toBe(false);
    });

    it("falls back to the built-in answer when it is missing or is not a boolean", () => {
      expect(normalizeSettings({ rules: [] }).reveal).toBe(DEFAULT_SETTINGS.reveal);
      expect(normalizeSettings({ rules: [], reveal: "yes" }).reveal).toBe(DEFAULT_SETTINGS.reveal);
    });
  });

  it("hands out a copy, so editing the result cannot corrupt the default", () => {
    const settings = normalizeSettings(undefined);
    settings.rules.push({ from: "AGI", to: "???" });
    expect(DEFAULT_SETTINGS.rules).toEqual([{ from: "AI", to: "LLM" }]);
    expect(normalizeSettings(undefined).rules).toEqual([{ from: "AI", to: "LLM" }]);
  });
});
