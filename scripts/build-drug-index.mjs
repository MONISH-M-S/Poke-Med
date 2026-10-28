/**
 * Build the compact drug index the app ships.
 *
 *   npm run data:build      (after npm run data:fetch)
 *
 * Inputs  data/external/indian_medicine_data.csv   253,973 Indian products
 *         data/external/DDI_data.csv               DrugBank-derived pairs
 * Outputs lib/data/generated/brands.json           brand token -> salts
 *         lib/data/generated/ddi.json              salt pair -> interaction types
 *         lib/data/generated/meta.json             counts, sources, licences
 *
 * The raw files stay out of git; the generated JSON is committed so a deploy
 * never needs the 45 MB downloads.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { brandKey, canonicalSalt, compositionSalts } from "./lib/drug-names.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTERNAL = path.join(ROOT, "data", "external");
const OUT = path.join(ROOT, "lib", "data", "generated");

const MEDICINES = path.join(EXTERNAL, "indian_medicine_data.csv");
const DDI = path.join(EXTERNAL, "DDI_data.csv");

/** A brand token is only trusted when one composition dominates its products. */
const DOMINANCE = 0.5;
const MAX_SALTS = 6;
const MAX_TYPES = 6;

/**
 * DrugBank's extract includes a few very broad phrases that are true of almost
 * any pair ("risk or severity of adverse effects", "therapeutic efficacy").
 * Surfacing them as safety flags is alarm fatigue, so they are dropped; the
 * specific mechanisms (bleeding, QT, metabolism, serum concentration…) stay.
 */
const LOW_SIGNAL_TYPES = new Set([
  "risk or severity of adverse effects",
  "therapeutic efficacy",
]);

/** Words that describe a pack, not a variant of the brand. */
const FORM_WORDS = new Set([
  "tablet", "tablets", "tab", "tabs", "capsule", "capsules", "cap", "caps",
  "syrup", "suspension", "susp", "injection", "inj", "drops", "drop",
  "ointment", "cream", "gel", "lotion", "spray", "inhaler", "sachet", "powder",
  "solution", "emulsion", "granules", "kit", "pen", "vial", "ampoule", "respules",
  "rotacaps", "softgel", "lozenge", "lozenges", "mouthwash", "paste", "shampoo",
  "foam", "patch", "suppository", "eye", "ear", "nasal", "oral", "film",
  "dispersible", "chewable", "effervescent", "sustained", "release",
  "sr", "er", "cr", "xr", "mr", "pr", "ds", "of", "strip", "bottle", "tube",
  "box", "pack",
]);

/**
 * True for "Ecosprin 75 Tablet", false for "Ecosprin AV 75 Tablet".
 * Combination families (AV, GP, H, D, Plus…) must not decide what the plain
 * brand contains — that is exactly how a plain Ecosprin would inherit a statin.
 */
function isPlainProduct(name) {
  const tokens = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  for (const token of tokens.slice(1)) {
    if (!token) continue;
    if (/^\d/.test(token)) continue; // strength or pack count
    if (FORM_WORDS.has(token)) continue;
    return false; // AV, GP, H, D, Duo, Plus, Advance…
  }
  return true;
}

const lines = (file) => readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });

async function readMedicines() {
  const brands = new Map(); // key -> Map(comboKey -> count)
  const plain = new Map(); // same, but only "brand + strength/form" products
  const allSalts = new Set();
  let rows = 0;
  let skipped = 0;
  let plainRows = 0;

  let header = true;
  for await (const raw of lines(MEDICINES)) {
    const line = raw.replace(/^\uFEFF/, "");
    if (header) { header = false; continue; }
    if (!line.trim()) continue;

    // The file is not valid CSV: commas inside the composition cells are not
    // quoted. The first seven columns are stable, so treat the rest as one.
    const parts = line.split(",");
    if (parts.length < 8) { skipped += 1; continue; }

    const name = parts[1]?.trim();
    const composition = parts.slice(7).join(",").trim();
    const key = brandKey(name);
    if (!key) { skipped += 1; continue; }

    const salts = compositionSalts(composition);
    if (salts.length === 0) { skipped += 1; continue; }
    for (const s of salts) allSalts.add(s);

    const combo = salts.slice(0, MAX_SALTS).join(" + ");
    const bucket = brands.get(key) ?? new Map();
    bucket.set(combo, (bucket.get(combo) ?? 0) + 1);
    brands.set(key, bucket);

    if (isPlainProduct(name)) {
      const pb = plain.get(key) ?? new Map();
      pb.set(combo, (pb.get(combo) ?? 0) + 1);
      plain.set(key, pb);
      plainRows += 1;
    }
    rows += 1;
  }

  const index = {};
  const ambiguous = [];
  const suggest = [];
  for (const [key, bucket] of [...brands.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Prefer the plain product; fall back to the whole family when a brand only
    // exists in combination form (e.g. Augmentin 625 Duo).
    const chosen = plain.get(key) ?? bucket;
    const ranked = [...chosen.entries()].sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((n, [, c]) => n + c, 0);
    const [combo, count] = ranked[0];
    index[key] = combo.split(" + ");
    if (count / total < DOMINANCE) ambiguous.push(key);
    // Spelling hints use the whole family, so a plain product with many
    // combination variants still counts as a common brand.
    const familyTotal = [...bucket.values()].reduce((n, c) => n + c, 0);
    if (familyTotal >= 5) suggest.push(key);
  }

  return { index, ambiguous: ambiguous.sort(), suggest, allSalts, rows, plainRows, skipped };
}

async function readInteractions(allSalts) {
  const pairs = new Map();
  let rows = 0;
  let kept = 0;
  let skipped = 0;
  let header = true;

  for await (const raw of lines(DDI)) {
    const line = raw.replace(/^\uFEFF/, "");
    if (header) { header = false; continue; }
    if (!line.trim()) continue;
    const parts = line.split(",");
    if (parts.length < 5) { skipped += 1; continue; }
    rows += 1;

    // The interaction type is the last column; it can contain commas.
    const type = parts.slice(4).join(",").trim().toLowerCase();
    const a = canonicalSalt(parts[2]);
    const b = canonicalSalt(parts[3]);
    if (!a || !b || a === b) { skipped += 1; continue; }
    // Only keep pairs where both sides are real salts in the Indian dataset.
    if (!allSalts.has(a) || !allSalts.has(b)) { skipped += 1; continue; }

    const key = [a, b].sort().join("|");
    const set = pairs.get(key) ?? new Set();
    if (type && !LOW_SIGNAL_TYPES.has(type)) set.add(type);
    if (set.size === 0) { skipped += 1; continue; }
    pairs.set(key, set);
    kept += 1;
  }

  const index = {};
  for (const [key, types] of [...pairs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    index[key] = [...types].sort().slice(0, MAX_TYPES);
  }
  return { index, rows, kept, skipped };
}

const write = (file, value) => fsp.writeFile(path.join(OUT, file), value);

if (!fs.existsSync(MEDICINES) || !fs.existsSync(DDI)) {
  console.error("Missing data/external files. Run: npm run data:fetch");
  process.exit(1);
}

await fsp.mkdir(OUT, { recursive: true });

console.log("\nReading Indian medicine products…");
const meds = await readMedicines();
console.log(`  ${meds.rows.toLocaleString()} products (${meds.plainRows.toLocaleString()} plain) → ${Object.keys(meds.index).length.toLocaleString()} brand tokens, ${meds.allSalts.size.toLocaleString()} salts (${meds.skipped} skipped)`);
console.log(`  ${meds.ambiguous.length} ambiguous tokens will require review`);

console.log("\nReading drug-drug interactions…");
const ddi = await readInteractions(meds.allSalts);
console.log(`  ${ddi.rows.toLocaleString()} rows → ${Object.keys(ddi.index).length.toLocaleString()} usable salt pairs (${ddi.skipped} outside the Indian salt set)`);

/** Raw text modules keep tsc from inferring a 135k-key object literal. */
function brandsModule() {
  const rows = Object.entries(meds.index)
    .map(([key, salts]) => `${key}\t${salts.join("+")}`)
    .join("\n");
  return [
    "// Generated by scripts/build-drug-index.mjs — do not edit by hand.",
    "// One brand token per line: key<TAB>salt1+salt2",
    `export const BRANDS_RAW = ${JSON.stringify(rows)};`,
    "",
    "// Tokens whose products disagree on composition; always ask for review.",
    `export const AMBIGUOUS_RAW = ${JSON.stringify(meds.ambiguous.join("\n"))};`,
    "",
    "// Tokens seen on at least five products — the safe pool for spelling hints.",
    `export const SUGGEST_RAW = ${JSON.stringify(meds.suggest.join("\n"))};`,
    "",
  ].join("\n");
}

function ddiModule() {
  const rows = Object.entries(ddi.index)
    .map(([key, types]) => `${key}\t${types.join(";")}`)
    .join("\n");
  return [
    "// Generated by scripts/build-drug-index.mjs — do not edit by hand.",
    "// One pair per line: saltA|saltB<TAB>type1;type2",
    `export const DDI_RAW = ${JSON.stringify(rows)};`,
    "",
  ].join("\n");
}

await write("brands.data.ts", brandsModule());
await write("ddi.data.ts", ddiModule());
await write(
  "meta.ts",
  [
    "// Generated by scripts/build-drug-index.mjs — do not edit by hand.",
    `export const DRUG_INDEX_META = ${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        medicines: {
          rows: meds.rows,
          plainRows: meds.plainRows,
          brandTokens: Object.keys(meds.index).length,
          salts: meds.allSalts.size,
          ambiguous: meds.ambiguous.length,
          suggest: meds.suggest.length,
          source: "Indian Medicine Dataset — github.com/junioralive/Indian-Medicine-Dataset (MIT)",
        },
        interactions: {
          rows: ddi.rows,
          pairs: Object.keys(ddi.index).length,
          source: "DrugBank 5.1 DDI extract — Yu, 2020, doi:10.17632/md5czfsfnd.1 (CC BY 4.0)",
        },
      },
      null,
      2,
    )} as const;`,
    "",
  ].join("\n"),
);

const size = (f) => `${((fs.statSync(path.join(OUT, f)).size) / 1024 / 1024).toFixed(2)} MB`;
console.log(`\nWrote lib/data/generated/`);
for (const f of ["brands.data.ts", "ddi.data.ts", "meta.ts"]) console.log(`  ${f.padEnd(16)} ${size(f)}`);
console.log("");
