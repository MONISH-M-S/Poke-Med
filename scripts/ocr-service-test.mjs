/**
 * Integration test for the optional prescription-OCR service.
 *
 *   npm run build && node scripts/ocr-service-test.mjs
 *
 * Starts a mock Donut service, starts the production app pointed at it with
 * OCR_SERVICE_URL, and proves three things the unit tests cannot:
 *
 *   1. /api/scan asks the service first and parses its transcription.
 *   2. The shared secret is sent as x-ocr-key.
 *   3. When the service dies, the route falls back to needs-text instead of
 *      inventing medicines.
 *
 * No PyTorch or model download is involved; the real model is exercised by
 * services/ocr/README.md. This test covers the wiring around it.
 */
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const ROOT = process.cwd();
const IMG = path.join(ROOT, "public", "sample-prescription.png");
const SECRET = "test-ocr-secret";

const MOCK_TEXT = [
  "Tab. Dolo 650mg 1-1-1 PC x 3 days",
  "Cap. Pan 40 1-0-0 AC x 5 days",
].join("\n");

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

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
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

const appPort = await freePort();
const mockPort = await freePort();
const BASE = `http://127.0.0.1:${appPort}`;

let sawKey = null;
let sawType = null;
let sawBytes = 0;
let stillUp = true;

const mock = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, model: "mock-donut", loaded: true });
    return;
  }
  if (req.method === "POST" && req.url === "/ocr") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      sawKey = req.headers["x-ocr-key"] ?? null;
      sawType = req.headers["content-type"] ?? "";
      sawBytes = Buffer.concat(chunks).length;
      json(res, 200, { text: MOCK_TEXT, model: "mock-donut", chars: MOCK_TEXT.length });
    });
    return;
  }
  json(res, 404, { error: "not found" });
});

await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
console.log(`mock OCR service on :${mockPort}`);

const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const app = spawn(process.execPath, [nextBin, "start", "-p", String(appPort)], {
  cwd: ROOT,
  env: {
    ...process.env,
    OCR_SERVICE_URL: `http://127.0.0.1:${mockPort}`,
    OCR_SHARED_SECRET: SECRET,
    OPENAI_API_KEY: "",
  },
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

try {
  const ready = await waitForApp(BASE);
  if (!ready) {
    console.error("FAIL  the app did not start — run `npm run build` first, or check port conflicts.");
    process.exit(1);
  }

  const login = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
  });
  const cookie = login.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
  check("caregiver signs in", login.ok && Boolean(cookie), `status ${login.status}`);

  async function upload() {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(IMG)], { type: "image/png" }), "sample-prescription.png");
    return fetch(BASE + "/api/scan", { method: "POST", body: form, headers: { cookie } });
  }

  const first = await upload();
  const data = await first.json();

  check("image upload reaches the app", first.ok, `status ${first.status}`);
  check("the local OCR service is used before any other reader", data.mode === "vision", `mode=${data.mode}`);
  check("its transcription is kept as rawText", data.rawText === MOCK_TEXT, JSON.stringify(data.rawText));
  check("the transcription is parsed into medicines", data.medicines?.length === 2, `got ${data.medicines?.length}`);
  check("1-1-1 becomes three doses", data.medicines?.[0]?.times?.length === 3, JSON.stringify(data.medicines?.[0]?.times));
  check("Pan 40 before food", data.medicines?.[1]?.relationToFood === "before", data.medicines?.[1]?.relationToFood);
  check("the shared secret is sent as x-ocr-key", sawKey === SECRET, String(sawKey));
  check("the upload is multipart, not a JSON/base64 guess", String(sawType).startsWith("multipart/form-data"), String(sawType));
  check("the image bytes arrived at the service", sawBytes > 1000, `${sawBytes} bytes`);

  // Kill the service: the app must degrade honestly, not invent a dose.
  stillUp = false;
  mock.closeAllConnections?.();
  await new Promise((resolve) => mock.close(resolve));

  const second = await upload();
  const fallback = await second.json();
  check("missing service still returns 200", second.ok, `status ${second.status}`);
  check("missing service falls back to needs-text", fallback.mode === "needs-text", `mode=${fallback.mode}`);
  check("fallback names the OCR service", /OCR service/i.test(fallback.message ?? ""), String(fallback.message));
  check("no medicines are invented by the fallback", fallback.medicines?.length === 0, `got ${fallback.medicines?.length}`);
} finally {
  stopApp();
  if (stillUp) {
    mock.closeAllConnections?.();
    await new Promise((resolve) => mock.close(resolve));
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
