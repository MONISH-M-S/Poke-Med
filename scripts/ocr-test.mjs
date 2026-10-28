/**
 * Browser OCR screenshot check against a running server.
 *
 *   node scripts/ocr-test.mjs          # http://localhost:3000
 *
 * Loads the synthetic sample photo through the real upload screen, waits for
 * browser OCR, and writes screenshots to data/ocr-lab/ (git-ignored). This is a
 * visual companion to scripts/ui-test.mjs, which asserts the same flow.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "ocr-lab");
fs.mkdirSync(OUT, { recursive: true });

const login = await fetch(BASE + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
});
const cookie = login.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
if (!login.ok || !cookie) {
  console.error("FAIL  could not sign in — is the server running?");
  process.exit(1);
}

const [name, value] = cookie.split("=");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
await context.addCookies([{ name, value, url: BASE }]);
const page = await context.newPage();
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));

await fetch(BASE + "/api/demo", {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify({ action: "reset" }),
});

await page.goto(BASE + "/upload", { waitUntil: "networkidle" });
await page.setInputFiles("#rx-file", path.join(process.cwd(), "public", "sample-prescription.png"));
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Read prescription" }).click();

try {
  await page.waitForURL("**/review", { timeout: 180000 });
  const names = await page.locator("input[value]").evaluateAll((els) =>
    els.map((e) => e.value).filter((v) => v && v.length < 40),
  );
  console.log("OCR reached review. Values:", names.join(" | "));
  await page.screenshot({ path: path.join(OUT, "review-ocr.png") });
} catch {
  const body = await page.locator("body").innerText();
  console.log("Did not reach review.");
  console.log(body.slice(0, 1200));
  await page.screenshot({ path: path.join(OUT, "review-ocr-failed.png") });
}

console.log("\nConsole tail:");
console.log(logs.slice(-10).join("\n"));
await browser.close();
