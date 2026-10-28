/**
 * Security and privacy checks.
 *
 *   npm run build && node scripts/security-test.mjs
 *
 * Two layers:
 *   1. Repository audit — no secrets, databases, personal photos, emails, phone
 *      numbers or LAN addresses in tracked files; no dangerous DOM sinks.
 *   2. Live HTTP audit — auth gates, cookie flags, forged/tampered sessions,
 *      elder/caregiver separation, pairing-token single use and revocation,
 *      upload limits, malformed input, security headers, secret leakage and
 *      the sign-in throttle.
 *
 * It starts its own production server on a free port and never needs a real
 * OCR/vision key. Synthetic demo data only.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { spawn, spawnSync } from "node:child_process";

const ROOT = process.cwd();
const IMG = path.join(ROOT, "public", "sample-prescription.png");

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

// ---------------------------------------------------------------- repo audit

const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const forbidden = [
  [/^\.env$/, ".env"],
  [/^\.env\.(?!example$)/, "a local env file"],
  [/^data\/db\.json/, "the runtime database"],
  [/^data\/elder-sessions\.json/, "paired-device state"],
  [/^data\/uploads\/(?!\.gitkeep$)/, "an uploaded photo"],
  [/^data\/external\//, "raw downloaded datasets"],
  [/^data\/ocr-(bench|lab)\//, "OCR bench/lab output"],
  [/^priscrip/, "a local prescription-photo folder"],
  [/^server\.log$/, "a local server log"],
  [/^\.vercel\//, "Vercel project metadata"],
  [/\.(pem|key|p12|pfx)$/, "a private key"],
];
for (const [pattern, label] of forbidden) {
  const hit = tracked.filter((file) => pattern.test(file));
  check(`repository does not track ${label}`, hit.length === 0, hit.join(", "));
}

for (const file of [".env.local", "data/db.json", "data/elder-sessions.json", "data/ocr-lab"]) {
  if (!fs.existsSync(path.join(ROOT, file))) continue;
  let ignored = true;
  try {
    execFileSync("git", ["check-ignore", "-q", file], { cwd: ROOT });
  } catch {
    ignored = false;
  }
  check(`${file} is git-ignored`, ignored);
}

const textExt = /\.(ts|tsx|js|mjs|json|md|css|example|txt|html|yml|yaml)$/i;
const sourceFiles = tracked.filter(
  (file) => /^(app|components|lib|scripts)\//.test(file) && /\.(ts|tsx|mjs|js)$/.test(file),
);
const textFiles = tracked.filter((file) => textExt.test(file) && !file.endsWith("package-lock.json"));

const secretPatterns = [
  [/sk-[A-Za-z0-9_-]{20,}/g, "an OpenAI-style key"],
  [/AKIA[0-9A-Z]{16}/g, "an AWS key"],
  [/gh[pousr]_[A-Za-z0-9]{30,}/g, "a GitHub token"],
  [/AIza[0-9A-Za-z_-]{35}/g, "a Google API key"],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, "a Slack token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "a private key"],
  [/AUTH_SECRET\s*=\s*[A-Fa-f0-9]{32,}/g, "a hard-coded AUTH_SECRET"],
];

const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const phonePattern = /\+91[\s-]?[6-9]\d{9}\b/g;
const lanPattern =
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g;

const findings = [];
for (const file of textFiles) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for (const [pattern, label] of secretPatterns) {
    for (const match of text.matchAll(pattern)) {
      findings.push(`${file}: ${label} (${match[0].slice(0, 12)}…)`);
    }
  }
  for (const match of text.matchAll(emailPattern)) {
    if (match[0] !== "alerts@example.com") findings.push(`${file}: email ${match[0]}`);
  }
  for (const match of text.matchAll(phonePattern)) findings.push(`${file}: Indian phone ${match[0]}`);
  for (const match of text.matchAll(lanPattern)) findings.push(`${file}: LAN address ${match[0]}`);
}
const uniqueFindings = [...new Set(findings)];
check(
  "tracked text has no secrets, personal emails/phones or LAN addresses",
  uniqueFindings.length === 0,
  uniqueFindings.slice(0, 6).join(" | "),
);

const sourceText = sourceFiles
  .map((file) => path.join(ROOT, file))
  .filter((file) => fs.existsSync(file))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
check("no dangerouslySetInnerHTML in app code", !/dangerouslySetInnerHTML/.test(sourceText));
check("no eval()/new Function() in app code", !/\beval\s*\(|new Function\s*\(/.test(sourceText));

// ---------------------------------------------------------------- live app

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
  env: {
    ...process.env,
    OPENAI_API_KEY: "",
    OCR_SERVICE_URL: "",
    OCR_SHARED_SECRET: "",
    POKEMED_TRUST_PROXY: "",
    NEXT_PUBLIC_APP_URL: BASE,
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

const cookieFrom = (res) => {
  const raw = res.headers.getSetCookie?.()[0] ?? res.headers.get("set-cookie") ?? "";
  return raw;
};

try {
  if (!(await waitForApp(BASE))) {
    console.error("FAIL  the app did not start — run `npm run build` first, or check port conflicts.");
    process.exit(1);
  }

  // Headers and public pages
  const loginPage = await fetch(BASE + "/login");
  const csp = loginPage.headers.get("content-security-policy") ?? "";
  check("CSP is sent", csp.length > 0);
  check("CSP blocks framing", /frame-ancestors 'none'/.test(csp));
  check("CSP has no third-party QR service", !/qrserver|api\.qrserver/.test(csp));
  check("CSP blocks plugins/objects", /object-src 'none'/.test(csp));
  check("X-Content-Type-Options is nosniff", loginPage.headers.get("x-content-type-options") === "nosniff");
  check("X-Frame-Options is DENY", loginPage.headers.get("x-frame-options") === "DENY");
  check("Referrer-Policy is set", Boolean(loginPage.headers.get("referrer-policy")));
  check("Permissions-Policy is set", Boolean(loginPage.headers.get("permissions-policy")));

  // Signed-out gates
  const root = await fetch(BASE + "/", { redirect: "manual" });
  check("/ redirects signed-out visitors to /login", root.status === 307 && /\/login/.test(root.headers.get("location") ?? ""));
  const uploadPage = await fetch(BASE + "/upload", { redirect: "manual" });
  check(
    "/upload redirects signed-out visitors to /login",
    uploadPage.status === 307 && /\/login\?next=%2Fupload/.test(uploadPage.headers.get("location") ?? ""),
  );
  const elderPage = await fetch(BASE + "/elder", { redirect: "manual" });
  check(
    "/elder without a paired phone goes to /pair/invalid",
    elderPage.status === 307 && /\/pair\/invalid/.test(elderPage.headers.get("location") ?? ""),
  );

  const noAuthState = await fetch(BASE + "/api/state");
  check("signed-out /api/state is 401", noAuthState.status === 401);
  const noAuthScan = await fetch(BASE + "/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Tab. Dolo 650mg 1-0-1" }),
  });
  check("signed-out /api/scan is 401", noAuthScan.status === 401);
  const noAuthDevices = await fetch(BASE + "/api/pair/devices");
  check("signed-out /api/pair/devices is 403", noAuthDevices.status === 403);

  // Caregiver login and cookie flags
  const login = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
  });
  const loginBody = await login.json();
  const caregiverRaw = cookieFrom(login);
  const caregiverCookie = caregiverRaw.split(";")[0];
  check("caregiver login succeeds", login.ok && loginBody.role === "caregiver", `status ${login.status}`);
  check("login response has no hash or signing secret", !/pinHash|AUTH_SECRET|scrypt:/i.test(JSON.stringify(loginBody)));
  check("caregiver cookie is HttpOnly", /HttpOnly/i.test(caregiverRaw));
  check("caregiver cookie is SameSite=Lax", /SameSite=Lax/i.test(caregiverRaw));
  check("caregiver cookie is host-only", !/Domain=/i.test(caregiverRaw));
  check("caregiver cookie path is /", /Path=\//i.test(caregiverRaw));
  check("caregiver cookie is not marked Secure on plain HTTP", !/;\s*Secure/i.test(caregiverRaw));

  const token = caregiverCookie.slice(caregiverCookie.indexOf("=") + 1);
  const [payload, signature] = token.split(".");
  const tampered = `${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  const tamperedState = await fetch(BASE + "/api/state", { headers: { cookie: `pokemed_session=${tampered}` } });
  check("a tampered session signature is rejected", tamperedState.status === 401);

  const forgedPayload = Buffer.from(
    JSON.stringify({ pid: "per_demo", role: "caregiver", name: "forged", exp: Date.now() + 86_400_000 }),
  ).toString("base64url");
  const forgedState = await fetch(BASE + "/api/state", {
    headers: { cookie: `pokemed_session=${forgedPayload}.AAAA` },
  });
  check("an unsigned/forged session is rejected", forgedState.status === 401);

  const me = await fetch(BASE + "/api/auth/me", { headers: { cookie: caregiverCookie } });
  const meBody = await me.json();
  check("/api/auth/me exposes only role/name/pid", me.ok && "role" in meBody && !("pinHash" in meBody));

  const elderDoor = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "elder", pin: "1234" }),
  });
  check("the elder PIN door stays closed", elderDoor.status === 400);

  // Pairing: local QR, single-use token, role separation, revocation
  const create = await fetch(BASE + "/api/pair/create", { method: "POST", headers: { cookie: caregiverCookie } });
  const pair = await create.json();
  check("caregiver can create a pairing token", create.ok && /^[0-9a-f-]{36}$/i.test(pair.token ?? ""));
  check("pairing token expires in five minutes", pair.expiresIn === 300);
  check("the QR is generated locally as a data URL", String(pair.qr).startsWith("data:image/png;base64,"));
  check("the QR contains no third-party URL", !/https?:\/\//.test(String(pair.qr)));

  const redeem = await fetch(pair.pairingUrl, { redirect: "manual" });
  const elderRaw = cookieFrom(redeem);
  const elderCookie = elderRaw.split(";")[0];
  check(
    "a valid pairing link opens the elder screen",
    redeem.status === 307 && /\/elder$/.test(redeem.headers.get("location") ?? ""),
  );
  check("elder cookie is HttpOnly", /HttpOnly/i.test(elderRaw));
  check("elder cookie is SameSite=Lax", /SameSite=Lax/i.test(elderRaw));

  const secondRedeem = await fetch(pair.pairingUrl, { redirect: "manual" });
  check(
    "the pairing link is single-use",
    secondRedeem.status === 307 && /\/pair\/invalid/.test(secondRedeem.headers.get("location") ?? ""),
  );

  const elderState = await fetch(BASE + "/api/state", { headers: { cookie: elderCookie } });
  check("the paired phone can read its own state", elderState.status === 200);
  const elderDemo = await fetch(BASE + "/api/demo", {
    method: "POST",
    headers: { cookie: elderCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
  check("the paired phone cannot call caregiver APIs", elderDemo.status === 403);
  const elderScan = await fetch(BASE + "/api/scan", {
    method: "POST",
    headers: { cookie: elderCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Tab. Dolo 650mg 1-0-1" }),
  });
  check("the paired phone cannot call the scan API", elderScan.status === 403);
  const elderDevices = await fetch(BASE + "/api/pair/devices", { headers: { cookie: elderCookie } });
  check("the paired phone cannot list/revoke devices", elderDevices.status === 403);
  const elderAtUpload = await fetch(BASE + "/upload", { redirect: "manual", headers: { cookie: elderCookie } });
  check(
    "the paired phone is redirected away from caregiver pages",
    elderAtUpload.status === 307 && /\/elder$/.test(elderAtUpload.headers.get("location") ?? ""),
  );

  const devices = await fetch(BASE + "/api/pair/devices", { headers: { cookie: caregiverCookie } });
  const devicesBody = await devices.json();
  const elderToken = elderCookie.slice(elderCookie.indexOf("=") + 1);
  const elderSid = JSON.parse(Buffer.from(elderToken.split(".")[0], "base64url").toString()).sid;
  const device = (devicesBody.data ?? []).find((d) => d.token === elderSid);
  check("the caregiver can see the paired phone", devices.ok && Boolean(device?.token));
  if (device?.token) {
    const revoke = await fetch(BASE + "/api/pair/devices", {
      method: "DELETE",
      headers: { cookie: caregiverCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ token: device.token }),
    });
    check("the caregiver can revoke the phone", revoke.ok);
    const afterRevoke = await fetch(BASE + "/api/state", { headers: { cookie: elderCookie } });
    check("a revoked phone loses API access", afterRevoke.status === 401);
  }

  // Upload and body hardening
  const scan = async (body) =>
    fetch(BASE + "/api/scan", {
      method: "POST",
      headers: { cookie: caregiverCookie, "Content-Type": "application/json" },
      body,
    });
  const malformed = await scan("{");
  check("malformed JSON is a 400, not a 500", malformed.status === 400, String(malformed.status));
  const wrongType = await scan(JSON.stringify({ text: 123 }));
  check("non-string prescription text is a 400", wrongType.status === 400);
  const tooLong = await scan(JSON.stringify({ text: "A".repeat(100_001) }));
  check("oversized text is a 413", tooLong.status === 413, String(tooLong.status));

  const upload = async (blob, name) => {
    const form = new FormData();
    form.append("file", blob, name);
    return fetch(BASE + "/api/scan", { method: "POST", headers: { cookie: caregiverCookie }, body: form });
  };
  const textFile = await upload(new Blob(["not an image"], { type: "text/plain" }), "evil.txt");
  check("a non-image upload is a 415", textFile.status === 415);
  const svg = await upload(
    new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], {
      type: "image/svg+xml",
    }),
    "evil.svg",
  );
  check("an SVG with a script is a 415", svg.status === 415);
  const empty = await upload(new Blob([], { type: "image/png" }), "empty.png");
  check("an empty image is a 400", empty.status === 400);
  const huge = await upload(new Blob([Buffer.alloc(9 * 1024 * 1024)], { type: "image/png" }), "huge.png");
  check("an image over 8 MB is a 413", huge.status === 413, String(huge.status));
  const good = await upload(new Blob([fs.readFileSync(IMG)], { type: "image/png" }), "sample-prescription.png");
  const goodBody = await good.json();
  check(
    "a valid image still reaches the honest no-service fallback",
    good.ok && goodBody.mode === "needs-text" && goodBody.medicines.length === 0,
    `mode=${goodBody.mode}`,
  );

  const commit = await fetch(BASE + "/api/prescriptions/commit", {
    method: "POST",
    headers: { cookie: caregiverCookie, "Content-Type": "application/json" },
    body: "{",
  });
  check("malformed commit JSON is a 400", commit.status === 400, String(commit.status));
  const invalidCommit = await fetch(BASE + "/api/prescriptions/commit", {
    method: "POST",
    headers: { cookie: caregiverCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ medicines: [null] }),
  });
  check("a commit with no valid medicines is a 400", invalidCommit.status === 400, String(invalidCommit.status));

  const doseBadJson = await fetch(BASE + "/api/doses", {
    method: "POST",
    headers: { cookie: caregiverCookie, "Content-Type": "application/json" },
    body: "{",
  });
  check("malformed dose JSON is a 400", doseBadJson.status === 400);
  const doseBadId = await fetch(BASE + "/api/doses", {
    method: "POST",
    headers: { cookie: caregiverCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ doseId: 123, action: "taken" }),
  });
  check("a non-string dose id is a 400", doseBadId.status === 400);

  const state = await fetch(BASE + "/api/state", { headers: { cookie: caregiverCookie } });
  const stateText = await state.text();
  check("state is not cached", state.headers.get("cache-control") === "no-store");
  check("state exposes no pin hash or server secrets", !/pinHash|AUTH_SECRET|OPENAI_API_KEY|OCR_SHARED_SECRET/i.test(stateText));

  // The signing secret must never be in the client bundle or page HTML.
  let envPairs = [];
  try {
    const envText = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
    envPairs = envText
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")])
      .filter(([key, value]) => value && !key.startsWith("NEXT_PUBLIC_"));
  } catch {
    // build/start generates AUTH_SECRET; if missing, the server would have failed closed.
  }
  const envSecret = envPairs.find(([key]) => key === "AUTH_SECRET")?.[1] ?? "";
  if (envSecret) {
    const html = await (await fetch(BASE + "/login")).text();
    check("the signing secret is not in the page HTML", !html.includes(envSecret));
  }
  const staticDir = path.join(ROOT, ".next", "static");
  const leakedKeys = [];
  if (envPairs.length && fs.existsSync(staticDir)) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(js|json|txt|map)$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, "utf8");
        for (const [key, value] of envPairs) {
          if (text.includes(value)) leakedKeys.push(key);
        }
      }
    };
    walk(staticDir);
  }
  check(
    "no server-only env value is in the client bundle",
    leakedKeys.length === 0,
    [...new Set(leakedKeys)].join(", "),
  );

  // Sign-in throttle last: it locks this process's client key for five minutes.
  let wrong = 0;
  for (let i = 0; i < 8; i += 1) {
    const res = await fetch(BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${i + 1}` },
      body: JSON.stringify({ mode: "caregiver", pin: "0000" }),
    });
    if (res.status === 401) wrong += 1;
  }
  check("eight wrong PINs are rejected", wrong === 8, `${wrong}/8`);
  const throttled = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.99" },
    body: JSON.stringify({ mode: "caregiver", pin: "0000" }),
  });
  check("the ninth attempt is throttled (rotating x-forwarded-for does not help)", throttled.status === 429);
  const throttledRight = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
  });
  check("the throttle applies even to a correct PIN", throttledRight.status === 429);
} finally {
  stopApp();
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
