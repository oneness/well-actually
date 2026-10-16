// Serves tests/fixtures over http, because content scripts do not run on
// file:// pages without extra user opt-in. Used by playwright.config.ts.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

createServer(async (request, response) => {
  const [path = "/"] = (request.url ?? "/").split("?");
  const requested = normalize(decodeURIComponent(path));
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
