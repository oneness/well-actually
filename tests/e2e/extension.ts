import { expect, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

export const EXTENSION_DIR = resolve("dist");

/**
 * Chromium derives an unpacked extension's id from the absolute path of its
 * directory: the first sixteen bytes of the SHA-256, each nibble mapped onto
 * a-p. Working it out here means a test can open the extension's own pages
 * without needing a background worker to ask for the id.
 */
export function extensionId(directory: string): string {
  const digest = createHash("sha256").update(resolve(directory)).digest("hex").slice(0, 32);
  return [...digest].map((nibble) => String.fromCharCode(97 + parseInt(nibble, 16))).join("");
}

export const OPTIONS_URL = `chrome-extension://${extensionId(EXTENSION_DIR)}/options.html`;

/**
 * Put a settings record into the extension's storage, the way a user who has
 * used the options page would have. A fresh page each time, so nothing about
 * the options page's own state carries over.
 */
export async function seedSettings(context: BrowserContext, settings: unknown): Promise<void> {
  const page = await context.newPage();
  await page.goto(OPTIONS_URL);

  // Without this, a wrong extension id turns every later failure into a
  // confusing one.
  await expect(page.locator("h1")).toHaveText("Well, Actually");

  await page.evaluate(
    (value) =>
      (
        globalThis as unknown as {
          chrome: { storage: { sync: { set(items: Record<string, unknown>): Promise<void> } } };
        }
      ).chrome.storage.sync.set({ settings: value }),
    settings,
  );

  await page.close();
}
