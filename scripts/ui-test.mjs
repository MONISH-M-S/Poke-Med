/**
 * Browser end-to-end test of the prototype.
 *
 *   npm run build && node scripts/ui-test.mjs
 *
 * Starts the production server on a free port and drives the real UI:
 *
 *   1. Sign in with the caregiver keypad.
 *   2. Paste an unknown brand and see the low-confidence safety copy.
 *   3. Read the sample prescription, edit one field, save, and land on the
 *      schedule.
 *   4. Create a one-time QR report link, open it in a signed-out browser, and
 *      confirm the first view works while a reload is refused.
 *   5. Load the sample photo, run browser OCR, and check the review screen
 *      still shows the photo (the old intermittent "missing image" bug).
 *   6. Assert there were no page errors or console errors.
 *
 * The photo pass uses Tesseract in Chromium, so it needs one network fetch for
 * the OCR worker on first run.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForApp(base, attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(base + "/login");
      if (res.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const port = await freePort();
const BASE = `http://127.0.0.1:${port}`;
const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

const app = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: ROOT,
  env: { ...process.env, OPENAI_API_KEY: "", OCR_SERVICE_URL: "", NEXT_PUBLIC_APP_URL: BASE },
  stdio: "ignore",
  windowsHide: true,
});

function stopApp() {
  if (app.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(app.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    app.kill("SIGTERM");
  }
}

let browser = null;
try {
  if (!(await waitForApp(BASE))) {
    console.error("FAIL  the app did not start — run `npm run build` first, or check port conflicts.");
    process.exit(1);
  }

  browser = await chromium.launch();
  fs.mkdirSync(path.join(ROOT, "data", "ocr-lab"), { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // 1. Caregiver keypad
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  for (const digit of "2468") {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  check("caregiver signs in through the keypad", true);

  const reset = await page.request.post(BASE + "/api/demo", { data: { action: "reset" } });
  check("demo resets for a known starting week", reset.ok(), `status ${reset.status()}`);

  // 2. Low-confidence copy for an unknown brand
  await page.goto(BASE + "/upload", { waitUntil: "domcontentloaded" });
  await page.locator("textarea").fill("Tab. Zzzznotadrug 10mg 1-0-1 PC");
  await page.getByRole("button", { name: "Read these lines" }).click();
  await page.waitForURL(/\/review$/, { timeout: 30_000 });
  await page.getByText(/read confidence/i).first().waitFor({ timeout: 15_000 });
  const lowScore = page.getByText(/60% read confidence/i).count();
  check("an unknown brand shows a 60% read confidence", (await lowScore) === 1);
  check(
    "a low score tells the caregiver to ask a pharmacist",
    (await page.getByText(/Ask your pharmacist before saving/i).count()) === 1,
  );
  await page.getByRole("link", { name: "Back" }).click();
  await page.waitForURL(/\/upload$/, { timeout: 15_000 });

  // 3. Text path: sample -> review -> edit -> save
  await page.getByRole("button", { name: "Use a sample" }).click();
  await page.getByRole("button", { name: "Read these lines" }).click();
  await page.waitForURL(/\/review$/, { timeout: 30_000 });
  await page.getByText(/read confidence/i).first().waitFor({ timeout: 15_000 });
  const rowCount = await page.getByText(/read confidence/i).count();
  check("the sample prescription produces three rows", rowCount === 3, `got ${rowCount}`);

  await page.getByLabel("Name").first().fill("Dolo 650");
  const edited = await page.getByLabel("Name").first().inputValue();
  check("the brand edit is kept before saving", edited === "Dolo 650", edited);
  await page.getByRole("button", { name: /Confirm & save schedule/i }).click();
  await page.waitForURL(/\/schedule/, { timeout: 30_000 });
  check("saving lands on the schedule", true);

  // The schedule loads /api/state after navigation, so wait for the list.
  let editOnSchedule = true;
  try {
    await page.getByText(/Dolo 650/i).first().waitFor({ timeout: 15_000 });
  } catch {
    editOnSchedule = false;
  }
  check("the edited medicine is on the schedule", editOnSchedule);

  // 4. One-time doctor report QR: create it, open it signed out, then confirm
  // that the used link cannot be replayed in a refreshed browser.
  await page.goto(BASE + "/report", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Share with doctor" }).click();
  await page.getByAltText("One-time report QR code").waitFor({ timeout: 15_000 });
  const shareUrl = (await page.locator("p.break-all").first().textContent())?.trim() ?? "";
  check("the report page shows a one-time QR link", shareUrl.startsWith(BASE + "/share/report/"));

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  publicPage.on("pageerror", (e) => pageErrors.push(e.message));
  publicPage.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await publicPage.goto(shareUrl, { waitUntil: "domcontentloaded" });
  const landingHasNoReport = (await publicPage.getByText("Doses taken").count()) === 0;
  await publicPage.getByRole("button", { name: "View report" }).click();
  await publicPage.getByText("Doses taken").waitFor({ timeout: 15_000 });
  check("the doctor can open the read-only report without signing in", landingHasNoReport);
  check(
    "the shared report shows the week summary",
    (await publicPage.getByText(/Shared medication report/i).count()) > 0,
  );
  await publicPage.reload({ waitUntil: "domcontentloaded" });
  await publicPage.getByText(/not available/i).waitFor({ timeout: 15_000 });
  check("reloading a consumed report link is refused", true);
  await publicContext.close();

  // 5. Photo path: sample photo -> browser OCR -> review with the image
  await page.goto(BASE + "/upload", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Load sample photo" }).click();
  await page.locator("#rx-preview").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("button", { name: "Read prescription" }).click();

  let photoReachedReview = true;
  try {
    await page.waitForURL(/\/review$/, { timeout: 240_000 });
  } catch {
    photoReachedReview = false;
  }
  check("browser OCR reaches the review screen", photoReachedReview);
  if (photoReachedReview) {
    await page.getByText(/read confidence/i).first().waitFor({ timeout: 15_000 });
    check(
      "the photo is still shown on review (no missing-image regression)",
      (await page.getByAltText("Uploaded prescription").count()) === 1,
    );
    const photoRows = await page.getByText(/read confidence/i).count();
    check("the photo pass found at least one medicine", photoRows >= 1, `got ${photoRows}`);
  }

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await page.screenshot({ path: path.join(ROOT, "data", "ocr-lab", "ui-review.png") });
} finally {
  if (browser) await browser.close();
  stopApp();
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
