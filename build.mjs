// Builds dist/: the content script bundled to one file, and the manifest with
// the package version stamped into it so the two can never disagree.
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const OUT = "dist";

const pkg = JSON.parse(await readFile("package.json", "utf8"));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

await build({
  entryPoints: ["src/content.ts"],
  outfile: `${OUT}/content.js`,
  bundle: true,
  format: "iife",
  target: ["chrome110", "firefox115"],
  sourcemap: true,
  logLevel: "info",
});

const manifest = JSON.parse(await readFile("static/manifest.json", "utf8"));
manifest.version = pkg.version;
await writeFile(`${OUT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

await cp("static", OUT, { recursive: true, filter: (path) => !path.endsWith("manifest.json") });
