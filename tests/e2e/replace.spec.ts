import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Loads the built extension into a real Chromium and shares it across the file,
 * because starting a browser profile with an extension is slow and the
 * extension keeps no state between tests.
 */
let context: BrowserContext;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = await mkdtemp(join(tmpdir(), "well-actually-"));

  context = await chromium.launchPersistentContext(userDataDir, {
    // Extensions are not loaded by headless Chromium. Run this where there is a
    // display (or under xvfb-run in CI).
    headless: false,
    args: [
      `--disable-extensions-except=${resolve("dist")}`,
      `--load-extension=${resolve("dist")}`,
    ],
  });

  page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
  await context.close();
  await rm(userDataDir, { force: true, recursive: true });
});

test.beforeEach(async () => {
  await page.goto("http://127.0.0.1:4173/basic.html");
});

const text = (selector: string) => page.locator(selector).innerText();

test("replaces a whole word", async () => {
  await expect(page.locator("#hero")).toHaveText("LLM is coming for your job");
});

test("leaves substrings and other capitalisations alone", async () => {
  expect(await text("#run")).toBe("The captain said the air here is fine.");
  expect(await text("#caps")).toBe("Ai Weiwei, and Ai Weiwei's studio.");
});

test("replaces around punctuation, inside a hyphenated phrase, and repeatedly", async () => {
  expect(await text("#powered")).toBe("An LLM-powered toaster, an LLM agent, and LLM.");
  expect(await text("#several")).toBe("LLM, LLM, and LLM again.");
});

test("leaves editors and code samples alone", async () => {
  expect(await page.locator("#editor").inputValue()).toBe("AI in a textarea");
  expect(await text("#editable")).toBe("AI in a contenteditable");
  expect(await text("#sample")).toBe('const AI = "AI";');
});

test("keeps up with content rendered after load", async () => {
  await expect(page.locator("#dynamic")).toHaveText("A late-breaking LLM paragraph.");
});

test("keeps up with a node edited in place", async () => {
  await expect(page.locator("#several")).toHaveText("LLM, LLM, and LLM again.");
});

test("settles rather than rewriting in a loop", async () => {
  await expect(page.locator("#dynamic")).toHaveText("A late-breaking LLM paragraph.");
  const before = await page.locator("body").innerText();
  await page.waitForTimeout(600);
  expect(await page.locator("body").innerText()).toBe(before);
});

test("survives a page replacing its own body", async () => {
  await page.goto("http://127.0.0.1:4173/rebuild.html");
  await expect(page.locator("#second")).toHaveText("LLM after the rebuild.");
});
