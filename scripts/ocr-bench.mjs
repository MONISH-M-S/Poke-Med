/**
 * Local OCR benchmark. Runs the real upload screen (browser OCR + parser) on a
 * folder of prescription photos and writes a report you can read.
 *
 *   node scripts/ocr-bench.mjs "priscrip'"
 *
 * The report goes to data/ocr-bench/ (git-ignored). Photos are never uploaded
 * anywhere: browser OCR runs in the local Chromium instance, and only the
 * extracted text is sent to the app's own /api/scan endpoint on localhost.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const folder = path.resolve(process.argv[2] ?? "priscrip'");
const only = process.argv[3] ?? "";
const outDir = path.join(process.cwd(), "data", "ocr-bench");
fs.mkdirSync(outDir, { recursive: true });

const IMAGE = /\.(jpe?g|png|webp|bmp|tiff?)$/i;
const files = fs
  .readdirSync(folder)
  .filter((f) => IMAGE.test(f) && f.includes(only))
  .map((f) => path.join(folder, f))
  .sort();

if (files.length === 0) {
  console.error(`No images found in ${folder}`);
  process.exit(1);
}

const login = await fetch(BASE + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
});
const raw = login.headers.getSetCookie?.()[0] ?? "";
const [name, ...rest] = raw.split(";")[0].split("=");
if (!login.ok || !name) {
  console.error("Could not sign in as the caregiver. Is the app running on :3000?");
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name, value: rest.join("="), domain: "localhost", path: "/" }]);
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

const rows = [];

for (const file of files) {
  const started = Date.now();
  await page.goto(BASE + "/upload", { waitUntil: "networkidle" });

  const waitForParse = page
    .waitForResponse(
      (res) =>
        res.url() === BASE + "/api/scan" &&
        res.request().method() === "POST" &&
        (res.request().headers()["content-type"] ?? "").includes("application/json"),
      { timeout: 150_000 },
    )
    .then((res) => res.json())
    .catch(() => null);

  // The app stays on the page when OCR returns nothing, so don't wait forever.
  const waitForProblem = page
    .waitForSelector("div.text-warn, div.text-alert", { timeout: 150_000 })
    .then(() => null)
    .catch(() => null);

  await page.setInputFiles("#rx-file", file);
  await page.waitForSelector("#rx-preview", { timeout: 20_000 });
  await page.getByRole("button", { name: "Read prescription" }).click();

  let result = null;
  let error = "";
  result = await Promise.race([waitForParse, waitForProblem]);
  if (!result) error = "OCR returned nothing — the app stayed on the upload page";

  // If OCR found nothing the app stays on the page and explains why.
  const uiMessage = await page
    .locator("div.text-warn, div.text-alert")
    .allTextContents()
    .then((all) => all.join(" ").trim())
    .catch(() => "");

  const seconds = Math.round((Date.now() - started) / 100) / 10;
  const row = {
    file: path.basename(file),
    seconds,
    error,
    console: consoleErrors.splice(0),
    mode: result?.mode ?? null,
    chars: result?.rawText?.length ?? 0,
    lines: result?.rawText ? result.rawText.split(/\r?\n/).filter((l) => l.trim()).length : 0,
    uiMessage,
    medicines: (result?.medicines ?? []).map((m) => ({
      brand: m.brand,
      strength: m.strength ?? null,
      times: m.times,
      prn: m.prn,
      known: !(m.notes ?? []).some((n) => /not in our list/i.test(n)),
      confidence: m.confidence,
      notes: m.notes ?? [],
      rawSig: m.rawSig,
    })),
    rawText: result?.rawText ?? "",
  };
  rows.push(row);

  console.log(
    `${row.file}: ${row.seconds}s, ${row.lines} lines, ${row.medicines.length} medicine(s)` +
      (row.medicines.length ? " — " + row.medicines.map((m) => m.brand).join(", ") : "") +
      (row.error ? " — ERROR " + row.error : ""),
  );
}

await browser.close();

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = path.join(outDir, `report-${stamp}.json`);
fs.writeFileSync(reportPath, JSON.stringify({ folder, createdAt: new Date().toISOString(), rows }, null, 2));

const total = rows.reduce((n, r) => n + r.medicines.length, 0);
console.log(`\n${rows.length} images, ${total} medicine lines parsed.`);
console.log(`Report: ${reportPath}`);
