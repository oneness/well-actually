import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EXTENSION_DIR, OPTIONS_URL, clearSettings, seedSettings } from "./extension";

const BASIC = "http://127.0.0.1:4173/basic.html";
const REBUILD = "http://127.0.0.1:4173/rebuild.html";

/** The built-in map: what an install nobody has configured has. */
const BLUNT = { rules: [{ from: "AI", to: "LLM" }], reveal: false };

/**
 * Loads the built extension into a real Chromium and shares it across the file,
 * because starting a browser profile with an extension is slow. Tests that need
 * a different map re-seed storage and reload, so the order they run in does not
 * matter.
 */
let context: BrowserContext;
let page: Page;
let userDataDir: string;

/**
 * Chromium picks Wayland when the build defaults to it, and exits if there is no
 * Wayland session to connect to — which is what running under Xvfb looks like,
 * and what CI does. If there is an X display and no Wayland one, say so.
 */
const ozoneArgs =
  Boolean(process.env.DISPLAY) && !process.env.WAYLAND_DISPLAY ? ["--ozone-platform=x11"] : [];

test.beforeAll(async () => {
  userDataDir = await mkdtemp(join(tmpdir(), "well-actually-"));

  context = await chromium.launchPersistentContext(userDataDir, {
    // Extensions are not loaded by headless Chromium. Run this where there is a
    // display, or a virtual one.
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      ...ozoneArgs,
    ],
  });

  page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
  await context.close();
  await rm(userDataDir, { force: true, recursive: true });
});

/**
 * Every test starts from the built-in map on a page the extension has already
 * swept, so a test that reads unchanged text is reading it after the pass, not
 * before it.
 */
test.beforeEach(async () => {
  await seedSettings(context, BLUNT);
  await page.goto(BASIC);
  await expect(page.locator("#hero")).toHaveText("LLM is coming for your job");
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
  await expect(page.locator("#powered")).toHaveText("An LLM-powered toaster, an LLM agent, and LLM.");
  await expect(page.locator("#several")).toHaveText("LLM, LLM, and LLM again.");
});

test("leaves dotted tokens alone", async () => {
  await expect(page.locator("#dotted")).toHaveText("The Bancs.AI site is not AI.com or AI.pdf.");
});

test("still corrects a full stop after the word", async () => {
  await expect(page.locator("#fullstop")).toHaveText("I like LLM. It is an LLM world.");
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
  await page.goto(REBUILD);
  await expect(page.locator("#second")).toHaveText("LLM after the rebuild.");
});

test("uses the map the user saved", async () => {
  await seedSettings(context, {
    rules: [
      { from: "AI", to: "ML" },
      { from: "frontier model", to: "language model" },
    ],
    reveal: false,
  });
  await page.reload();

  await expect(page.locator("#hero")).toHaveText("ML is coming for your job");
});

test("prefers the longest rule on a real page", async () => {
  await seedSettings(context, {
    rules: [
      { from: "AI", to: "ML" },
      { from: "AI-powered", to: "LLM-powered" },
    ],
    reveal: false,
  });
  await page.reload();

  await expect(page.locator("#powered")).toHaveText("An LLM-powered toaster, an ML agent, and ML.");
});

test("does not correct its own correction", async () => {
  await seedSettings(context, {
    rules: [
      { from: "AI", to: "LLM" },
      { from: "LLM", to: "large language model" },
    ],
    reveal: false,
  });
  await page.reload();

  // The second rule must not get a second go at the first rule's output.
  await expect(page.locator("#hero")).toHaveText("LLM is coming for your job");
});

test("an empty map leaves the page alone", async () => {
  await seedSettings(context, { rules: [{ from: "PING", to: "PONG" }], reveal: false });
  await page.reload();

  // The signal is the extension's own proof that it ran; without it, reading
  // untouched text would pass whether or not the extension had done anything.
  await expect(page.locator("#signal")).toHaveText("PONG");
  expect(await text("#hero")).toBe("AI is coming for your job");
});

test("reveals the original wording on hover", async () => {
  await seedSettings(context, { rules: [{ from: "AI", to: "LLM" }], reveal: true });
  await page.reload();

  const correction = page.locator("#hero span.wa-replaced");
  await expect(correction).toHaveText("LLM");
  await expect(correction).toHaveAttribute("data-wa-original", "AI");
  expect(await text("#hero")).toBe("LLM is coming for your job");
});

test("reveals by default, with nothing configured at all", async () => {
  await clearSettings(context);
  await page.reload();

  await expect(page.locator("#hero span.wa-replaced")).toHaveCount(1);
  expect(await text("#hero")).toBe("LLM is coming for your job");
});

test("styles the revealed word so a reader can find it", async () => {
  await seedSettings(context, { rules: [{ from: "AI", to: "LLM" }], reveal: true });
  await page.reload();

  const correction = page.locator("#hero span.wa-replaced");
  await expect(correction).toHaveCount(1);

  const decoration = await correction.evaluate((element) => getComputedStyle(element).textDecorationLine);
  expect(decoration).toContain("underline");
});

test("the tooltip appears on hover and says what it is showing", async () => {
  await seedSettings(context, { rules: [{ from: "AI", to: "LLM" }], reveal: true });
  await page.reload();

  const correction = page.locator("#hero span.wa-replaced");
  await expect(correction).toHaveCount(1);

  const tooltip = (property: string) =>
    correction.evaluate(
      (element, name) => getComputedStyle(element, "::after").getPropertyValue(name),
      property,
    );

  await expect.poll(() => tooltip("opacity")).toBe("0");
  await correction.hover();
  await expect.poll(() => tooltip("opacity")).toBe("1");

  // The tooltip holds the very word the map replaces, so this is also the check
  // that it is generated content: as a text node the content script would have
  // found it and rewritten it to "original: LLM".
  const content = await tooltip("content");
  expect(content).toContain("original");
  expect(content).toContain("AI");
});

test("does not turn the pointer into a question mark", async () => {
  await seedSettings(context, { rules: [{ from: "AI", to: "LLM" }], reveal: true });
  await page.reload();

  const correction = page.locator("#hero span.wa-replaced");
  await expect(correction).toHaveCount(1);

  // "auto" is the initial value: the point is that we no longer set one.
  expect(await correction.evaluate((element) => getComputedStyle(element).cursor)).toBe("auto");
});

test("the options page saves a map the content script then uses", async () => {
  const options = await context.newPage();
  await options.goto(OPTIONS_URL);

  await options.getByRole("button", { name: /Strict/ }).click();
  await options.locator("#rules tr").first().locator(".to").fill("ML");
  await options.getByRole("button", { name: "Save" }).click();
  await expect(options.locator("#status")).toContainText("Saved");

  await options.reload();
  await expect(options.locator("#rules tr").first().locator(".to")).toHaveValue("ML");
  await options.close();

  await page.goto(BASIC);
  await expect(page.locator("#hero")).toHaveText("ML is coming for your job");
});
