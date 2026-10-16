// Packages dist/ for the two stores.
//
// One script, two archives. The only thing that differs is the manifest: Chrome
// warns about Firefox-only keys it cannot use, and that warning would sit in
// front of a reviewer. Everything else about the two archives is the same bytes,
// and the archives are byte-for-byte reproducible, so a published artifact can
// be checked against the source it came from.

import { readFile, readdir, mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { deflateRawSync } from "node:zlib";

const DIST = "dist";
const ARTIFACTS = "artifacts";

/**
 * What the extension needs at runtime, and nothing else: the manifest points at
 * the PNG icons, so the SVG they were generated from stays behind, and source
 * maps are a development aid.
 */
const NOT_SHIPPED = /\.(map|svg)$/;

/**
 * Firefox-only manifest keys, removed from the Chrome archive. A Chrome-only
 * key would need the mirror of this.
 */
const FIREFOX_ONLY = ["browser_specific_settings"];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

/**
 * A zip, written by hand rather than with a dependency, because all this needs
 * is deflate and a header. The date is pinned to the DOS epoch so that packing
 * the same files twice produces the same bytes.
 */
function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const body = deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed to extract
    header.writeUInt16LE(0, 6); // flags
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(0, 10); // modification time
    header.writeUInt16LE(0x21, 12); // modification date: 1980-01-01
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28); // extra field length

    local.push(header, name, body);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4); // version made by
    record.writeUInt16LE(20, 6); // version needed
    record.writeUInt16LE(0, 8); // flags
    record.writeUInt16LE(8, 10); // deflate
    record.writeUInt16LE(0, 12); // time
    record.writeUInt16LE(0x21, 14); // date
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(body.length, 20);
    record.writeUInt32LE(entry.data.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt16LE(0, 30); // extra field length
    record.writeUInt16LE(0, 32); // comment length
    record.writeUInt16LE(0, 34); // disk number start
    record.writeUInt16LE(0, 36); // internal attributes
    record.writeUInt32LE(0, 38); // external attributes
    record.writeUInt32LE(offset, 42);

    central.push(record, name);
    offset += header.length + name.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...local, directory, end]);
}

/** Every file to ship, as paths relative to `directory`, in a stable order. */
async function filesIn(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await filesIn(path, base)));
    } else if (!NOT_SHIPPED.test(path)) {
      found.push(relative(base, path));
    }
  }

  return found.sort();
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));

const contents = await Promise.all(
  (await filesIn(DIST)).map(async (name) => ({ name, data: await readFile(join(DIST, name)) })),
);

await rm(ARTIFACTS, { recursive: true, force: true });
await mkdir(ARTIFACTS, { recursive: true });

const written = {};

for (const target of ["chrome", "firefox"]) {
  const entries = contents.map((entry) => {
    if (entry.name !== "manifest.json") return entry;

    const manifest = JSON.parse(entry.data.toString("utf8"));
    if (target === "chrome") {
      for (const key of FIREFOX_ONLY) delete manifest[key];
    }

    return { name: entry.name, data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8") };
  });

  const file = join(ARTIFACTS, `well-actually-${pkg.version}-${target}.zip`);
  written[target] = zip(entries);
  await writeFile(file, written[target]);
  console.log(`${file} — ${entries.length} files`);
}

// The Firefox archive again under the name a local install wants. An XPI is a
// zip, and "Install Add-on From File" only offers files with that extension.
const xpi = join(ARTIFACTS, `well-actually-${pkg.version}.xpi`);
await writeFile(xpi, written.firefox);
console.log(`${xpi} — the Firefox archive, for installing by hand`);
