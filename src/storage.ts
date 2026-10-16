/**
 * Reading and writing the settings record. The shape and its validation live in
 * core/settings.ts; this is only the trip through the browser.
 */

import { webExtension } from "./browser";
import { normalizeSettings, STORAGE_KEY, type Settings } from "./core/settings";

export async function loadSettings(): Promise<Settings> {
  const stored = await webExtension?.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored?.[STORAGE_KEY]);
}

/**
 * Throws when the browser refuses the write — most likely the quota, which is a
 * few megabytes. The options page shows what went wrong rather than reporting a
 * save that did not happen.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  if (webExtension === undefined) {
    throw new Error("no extension storage available");
  }
  await webExtension.storage.local.set({ [STORAGE_KEY]: settings });
}
