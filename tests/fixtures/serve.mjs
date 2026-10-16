// Serves tests/fixtures over http, because content scripts do not run on
// file:// pages without extra user opt-in. Used by playwright.config.ts, and by
// scripts/check-firefox.sh for its /report endpoint.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const reportPath = process.env.REPORT_PATH ?? join(tmpdir(), "well-actually-firefox-report.txt");

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

createServer(async (request, response) => {
  const [path = "/"] = (request.url ?? "/").split("?");
  const requested = normalize(decodeURIComponent(path));

  // A fixture page reporting what it ended up with, for the Firefox check.
  if (requested === "/report") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    await writeFile(reportPath, Buffer.concat(chunks).toString("utf8"), "utf8");
    response.writeHead(204).end();
    return;
  }

  const file = join(root, requested === "/" ? "basic.html" : requested);

  if (!file.startsWith(root)) {
    response.writeHead(403).end("forbidden");
    return;
  }

  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1");
