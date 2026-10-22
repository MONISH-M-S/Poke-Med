import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const root = process.cwd();
const docs = path.join(root, "docs");
fs.mkdirSync(docs, { recursive: true });

let cookie = "";

function authHeaders(extra = {}) {
  return cookie ? { ...extra, cookie } : extra;
}

async function caregiverLogin() {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
  });
  const raw = res.headers.getSetCookie?.()[0] ?? res.headers.get("set-cookie") ?? "";
  cookie = raw.split(";")[0];
  if (!res.ok || !cookie) throw new Error("caregiver login failed: " + res.status);
}

async function reset() {
  await fetch(BASE + "/api/demo", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action: "reset" }),
  });
}

const browser = await chromium.launch();
const errors = [];

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  if (cookie) {
    const [name, ...rest] = cookie.split("=");
    await ctx.addCookies([{ name, value: rest.join("="), domain: "localhost", path: "/" }]);
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  return page;
}

async function shot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(docs, name), fullPage: false });
  console.log("shot", name);
}

// 1. Rasterise the sample prescription
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1180 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("file:///" + path.join(root, "public", "sample-prescription.svg").replaceAll("\\", "/"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(root, "public", "sample-prescription.png") });
  console.log("shot sample-prescription.png");
  await ctx.close();
}

// 2. The two-door sign-in screen (before we hold a session)
{
  const page = await newPage(1440, 1050);
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await shot(page, "login.png");
  await page.context().close();
}

await caregiverLogin();
await reset();

// 3. Dashboard
{
  const page = await newPage(1440, 1050);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "dashboard.png");
  await page.context().close();
}

// 3. Upload, with the sample photo and a crop drawn around the medicine lines
{
  const page = await newPage(1440, 1050);
  await page.goto(BASE + "/upload", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Load sample photo" }).click();
  await page.waitForSelector("#rx-preview", { timeout: 15000 });
  const box = await page.locator("#rx-preview").boundingBox();
  await page.mouse.move(box.x + box.width * 0.06, box.y + box.height * 0.18);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shot(page, "upload.png");
  await page.context().close();
}

// 4. Review, using the sample photo plus the typed sample
{
  const page = await newPage(1440, 1150);
  await page.goto(BASE + "/upload", { waitUntil: "networkidle" });
  await page.setInputFiles("#rx-file", path.join(root, "public", "sample-prescription.png"));
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Use a sample" }).click();
  await page.getByRole("button", { name: "Read these lines" }).click();
  await page.waitForURL("**/review", { timeout: 20000 });
  await page.waitForTimeout(900);
  await shot(page, "review.png");

  // 5. Save -> schedule with flags
  await page.getByRole("button", { name: /Confirm & save/ }).click();
  await page.waitForURL("**/schedule**", { timeout: 20000 });
  await page.waitForTimeout(900);
  await shot(page, "schedule.png");

  // 6. Flag detail
  await page.locator('a[href^="/flags/"]').first().click();
  await page.waitForURL("**/flags/**", { timeout: 20000 });
  await page.waitForTimeout(900);
  await shot(page, "flag.png");
  await page.context().close();
}

// 7. Report
{
  const page = await newPage(1440, 1050);
  await page.goto(BASE + "/report", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "report.png");
  await page.context().close();
}

// 8. Elder screen, desktop and phone (clock moved to the next dose first)
{
  await fetch(BASE + "/api/demo", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action: "nextDose" }),
  });
  const page = await newPage(1440, 1050);
  await page.goto(BASE + "/elder", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot(page, "elder.png");
  await page.context().close();

  const phone = await newPage(390, 844);
  await phone.goto(BASE + "/elder", { waitUntil: "networkidle" });
  await phone.waitForTimeout(900);
  await phone.screenshot({ path: path.join(docs, "elder-phone.png") });
  console.log("shot elder-phone.png");
  await phone.context().close();
}

// 9. The missed-dose alert on the caregiver dashboard
{
  await reset();
  await fetch(BASE + "/api/demo", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action: "nextMiss" }),
  });
  const page = await newPage(1440, 1050);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot(page, "dashboard-missed.png");
  await page.context().close();
}

await reset();
await browser.close();

if (errors.length) {
  console.log("\nBrowser errors:");
  for (const e of [...new Set(errors)]) console.log(" -", e);
} else {
  console.log("\nNo browser errors.");
}
