/**
 * What the user has configured, and the rules for reading it back.
 *
 * Pure, and separate from the storage call that fetches it, because everything
 * here is worth testing directly: this is the boundary where untrusted data
 * becomes the map that rewrites every page the user reads.
 */

import { DEFAULT_RULES, type Rule } from "./rules";

/** One key holding one record, so a read can never see half a settings change. */
export const STORAGE_KEY = "settings";

export interface Settings {
  /** The map, in the order the user arranged it. */
  rules: Rule[];
  /** Wrap each correction in a span, so hovering shows the original wording. */
  reveal: boolean;
}

/**
 * A fresh copy of the built-in settings. A function rather than a shared object
 * because callers own their rules array and will edit it.
 */
function defaults(): Settings {
  return { rules: [...DEFAULT_RULES], reveal: false };
}

export const DEFAULT_SETTINGS: Settings = defaults();

/** A rule that could only ever match nothing, or is not a rule at all. */
function toRule(value: unknown): Rule | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const { from, to } = value as { from?: unknown; to?: unknown };
  if (typeof from !== "string" || typeof to !== "string") return undefined;
  if (from === "") return undefined;

  return { from, to };
}

/**
 * Read a stored value into settings.
 *
 * Nothing here is trusted: storage outlives upgrades and is editable by hand, so
 * a malformed rule is dropped rather than allowed to reach the page.
 *
 * `undefined` means the user has never saved anything and gives the built-in
 * map. A list that is present but empty is a real choice — the extension does
 * nothing — and is left alone.
 */
export function normalizeSettings(value: unknown): Settings {
  if (typeof value !== "object" || value === null) return defaults();

  const { rules, reveal } = value as { rules?: unknown; reveal?: unknown };
  if (!Array.isArray(rules)) return defaults();

  return {
    rules: rules.map(toRule).filter((rule): rule is Rule => rule !== undefined),
    reveal: reveal === true,
  };
}
