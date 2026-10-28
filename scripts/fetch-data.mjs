/**
 * Download the external datasets Poke-Med builds its drug index from.
 *
 *   npm run data:fetch
 *
 * Files land in data/external/ (gitignored). They are large:
 *   indian_medicine_data.csv   ~30 MB   253,973 products, MIT
 *   DDI_data.csv               ~15 MB   DrugBank-derived pairs, CC BY 4.0
 *
 * Nothing here runs at request time. The committed output of the build step
 * lives in lib/data/generated/.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "external");

const SOURCES = [
  {
    name: "Indian Medicine Dataset (MIT)",
    file: "indian_medicine_data.csv",
    url: "https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.csv",
    bytes: 31_807_827,
  },
  {
    name: "DrugBank 5.1 DDI extract, Yu 2020 (CC BY 4.0)",
    file: "DDI_data.csv",
    url: "https://data.mendeley.com/public-files/datasets/md5czfsfnd/files/4530a4be-8cff-4cfb-a309-9343f92f6832/file_downloaded",
    bytes: 14_951_142,
    sha256: "816c0dbbc434b31c02baa1186cb010bd330c09f98150150e25aadbd6717a0e59",
  },
];

async function download({ name, file, url, bytes, sha256 }) {
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest)) {
    const size = (await fsp.stat(dest)).size;
    if (size === bytes) {
      console.log(`  ✓ ${file} already present (${mb(size)})`);
      return dest;
    }
    console.log(`  … ${file} is ${mb(size)}, expected ${mb(bytes)} — resuming`);
  }

  console.log(`  ↓ ${name}`);
  const part = dest + ".part";
  await fsp.mkdir(OUT, { recursive: true });

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const have = fs.existsSync(part) ? (await fsp.stat(part)).size : 0;
    if (have >= bytes) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    try {
      const res = await fetch(url, {
        headers: have ? { Range: `bytes=${have}-` } : {},
        redirect: "follow",
        signal: controller.signal,
      });
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fsp.appendFile(part, buf);
      console.log(`    ${mb((await fsp.stat(part)).size)} / ${mb(bytes)}`);
    } catch (err) {
      console.warn(`    attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
      if (attempt === 6) throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  const size = (await fsp.stat(part)).size;
  if (size !== bytes) throw new Error(`${file}: got ${size} bytes, expected ${bytes}`);

  if (sha256) {
    const hash = crypto.createHash("sha256").update(await fsp.readFile(part)).digest("hex");
    if (hash !== sha256) throw new Error(`${file}: checksum mismatch`);
    console.log(`    checksum ok`);
  }

  await fsp.rename(part, dest);
  console.log(`  ✓ ${file} (${mb(size)})`);
  return dest;
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

console.log("\nFetching external datasets into data/external/\n");
for (const source of SOURCES) await download(source);
console.log("\nDone. Next: npm run data:build\n");
