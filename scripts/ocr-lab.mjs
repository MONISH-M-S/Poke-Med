/**
 * OCR lab: compares page-segmentation modes and a grayscale/contrast/upscale
 * pass on real photos. Results go to data/ocr-lab/ (git-ignored) so no
 * prescription text is ever committed.
 *
 *   node scripts/ocr-lab.mjs "priscrip'"
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const folder = path.resolve(process.argv[2] ?? "priscrip'");
const outDir = path.join(process.cwd(), "data", "ocr-lab");
fs.mkdirSync(outDir, { recursive: true });

const IMAGE = /\.(jpe?g|png|webp|bmp|tiff?)$/i;
const files = fs
  .readdirSync(folder)
  .filter((f) => IMAGE.test(f))
  .map((f) => path.join(folder, f))
  .sort();

const KEYWORDS = [
  "tab", "cap", "syp", "inj", "mg", "ml", "mcg",
  "od", "bd", "tds", "tid", "qid", "hs", "sos", "prn", "stat", "pc", "ac", "iv", "im",
  "pan", "flagyl", "ecosprin", "metformin", "amlodipine", "atorvastatin", "paracetamol",
  "ibuprofen", "aspirin", "azithromycin", "pantoprazole", "cefuroxime", "saline",
];

const VARIANTS = [
  { name: "raw / auto", scale: 1, enhance: false, psm: "3" },
  { name: "raw / sparse", scale: 1, enhance: false, psm: "11" },
  { name: "enhanced / sparse", scale: 1, enhance: true, psm: "11" },
  { name: "enhanced / block", scale: 1, enhance: true, psm: "6" },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><meta charset=utf-8><body></body>");
await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" });

const report = [];

for (const file of files) {
  const dataUrl = "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64");
  const row = { file: path.basename(file), variants: [] };
  console.log("\n" + row.file);

  for (const variant of VARIANTS) {
    const started = Date.now();
    const out = await page.evaluate(
      async ({ dataUrl, enhance, psm }) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        const canvas = document.createElement("canvas");
        const scale = enhance ? Math.min(3, Math.max(1, 1600 / img.width)) : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (enhance) {
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = frame.data;
          const histogram = new Uint32Array(256);
          const lum = new Uint8ClampedArray(canvas.width * canvas.height);
          for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
            const value = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            lum[p] = value;
            histogram[value] += 1;
          }
          const total = lum.length;
          const pick = (fraction) => {
            let seen = 0;
            for (let v = 0; v < 256; v += 1) {
              seen += histogram[v];
              if (seen >= total * fraction) return v;
            }
            return 255;
          };
          const low = pick(0.02);
          const high = pick(0.98);
          const span = Math.max(1, high - low);
          for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
            const stretched = Math.max(0, Math.min(255, Math.round(((lum[p] - low) / span) * 255)));
            data[i] = stretched;
            data[i + 1] = stretched;
            data[i + 2] = stretched;
          }
          ctx.putImageData(frame, 0, 0);
        }

        const worker = await Tesseract.createWorker("eng", 1);
        await worker.setParameters({
          tessedit_pageseg_mode: psm,
          preserve_interword_spaces: "1",
        });
        const { data } = await worker.recognize(canvas);
        await worker.terminate();
        return { text: data.text, confidence: data.confidence };
      },
      { dataUrl, enhance: variant.enhance, psm: variant.psm },
    );

    const lower = out.text.toLowerCase();
    const hits = KEYWORDS.filter((k) => new RegExp(`\\b${k}\\b`).test(lower));
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    row.variants.push({
      ...variant,
      seconds,
      confidence: Math.round(out.confidence),
      chars: out.text.length,
      hits,
      text: out.text,
    });
    console.log(
      `  ${variant.name.padEnd(20)} ${String(seconds).padStart(5)}s  conf ${String(
        Math.round(out.confidence),
      ).padStart(3)}  hits ${hits.length} [${hits.slice(0, 8).join(", ")}]`,
    );
  }

  report.push(row);
}

await browser.close();

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(outDir, `lab-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 2));
console.log("\nReport: " + file);
