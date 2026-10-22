import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));

await fetch(BASE + "/api/demo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "reset" }),
});

await page.goto(BASE + "/upload", { waitUntil: "networkidle" });
await page.setInputFiles("#rx-file", path.join(process.cwd(), "public", "sample-prescription.png"));
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Read prescription" }).click();

try {
  await page.waitForURL("**/review", { timeout: 180000 });
  const names = await page.locator('input[value]').evaluateAll((els) =>
    els.map((e) => e.value).filter((v) => v && v.length < 40),
  );
  console.log("OCR reached review. Values:", names.join(" | "));
  await page.screenshot({ path: "docs/review-ocr.png" });
} catch {
  const body = await page.locator("body").innerText();
  console.log("Did not reach review.");
  console.log(body.slice(0, 1200));
  await page.screenshot({ path: "docs/review-ocr-failed.png" });
}

console.log("\nConsole tail:");
console.log(logs.slice(-10).join("\n"));
await browser.close();
