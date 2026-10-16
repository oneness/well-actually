import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // One browser for the whole run, so tests must not mutate shared state.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  webServer: {
    command: "node tests/fixtures/serve.mjs",
    url: "http://127.0.0.1:4173/basic.html",
    reuseExistingServer: true,
  },
});
