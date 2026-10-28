/**
 * Regenerate the synthetic prescription used by the demo and the OCR tests.
 *
 *   node scripts/make-sample.mjs
 *
 * The image is intentionally generic: no real doctor, patient, clinic,
 * registration number, address or phone number. It is rendered with Chromium so
 * the result is reproducible instead of a binary someone edited by hand.
 */
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.join(process.cwd(), "public", "sample-prescription.png");

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { width: 1100px; height: 1500px; padding: 34px; font-family: Georgia, "Times New Roman", serif; color: #1f2937; }
  .sheet { height: 100%; border: 2px solid #d1d5db; padding: 44px 48px; position: relative; }
  .doctor { font-size: 40px; font-weight: 700; letter-spacing: 0.2px; color: #111827; }
  .meta { margin-top: 8px; font-size: 20px; line-height: 1.45; color: #4b5563; }
  .rule { margin: 24px 0 22px; border-top: 2px solid #111827; }
  .row { display: flex; justify-content: space-between; font-size: 22px; color: #111827; }
  .rx { margin-top: 36px; font-size: 72px; font-style: italic; color: #0f5c46; line-height: 1; }
  .meds { margin-top: 28px; font-family: Consolas, "Courier New", monospace; font-size: 27px; line-height: 1.6; }
  .med { display: flex; gap: 24px; padding: 10px 0; }
  .name { width: 390px; }
  .dose { width: 210px; }
  .days { margin-left: auto; white-space: nowrap; }
  .advice { margin-top: 32px; padding-top: 22px; border-top: 1px solid #d1d5db; font-size: 22px; line-height: 1.6; color: #374151; }
  .sig { position: absolute; right: 48px; bottom: 150px; width: 280px; border-top: 2px solid #374151; padding-top: 10px; font-size: 19px; color: #4b5563; }
  .foot { position: absolute; left: 48px; bottom: 42px; font-size: 17px; color: #6b7280; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="doctor">Dr. A. Demo</div>
    <div class="meta">MBBS, MD (General Medicine) · Reg. No. DEMO-0000<br />
      Sample Clinic, Example Nagar, Chennai 600000<br />
      Mon–Sat, 9:00 AM – 1:00 PM</div>
    <div class="rule"></div>
    <div class="row">
      <span>Name: Sample Patient</span>
      <span>Age: 72</span>
      <span>Date: 22-10-2026</span>
    </div>
    <div class="rx">Rx</div>
    <div class="meds">
      <div class="med"><span class="name">Tab. Dolo 650mg</span><span class="dose">1-1-1 PC</span><span class="days">x 3 days</span></div>
      <div class="med"><span class="name">Tab. Ibuprofen 400mg</span><span class="dose">BD PC</span><span class="days">x 3 days</span></div>
      <div class="med"><span class="name">Tab. Metformin 500mg</span><span class="dose">1-0-1 PC</span><span class="days">x 30 days</span></div>
    </div>
    <div class="advice">Advice: plenty of fluids. Review in 3 days if fever continues.</div>
    <div class="sig">Signature</div>
    <div class="foot">Synthetic sample for the PokéMed prototype. Not a real prescription.</div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1500 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, fullPage: false });
  console.log(`Wrote ${OUT}`);
} finally {
  await browser.close();
}
