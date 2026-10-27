/**
 * Vision / OCR API tests against a running server.
 *
 *   node scripts/vision-test.mjs          # http://localhost:3000
 *   BASE=http://localhost:3000 node scripts/vision-test.mjs
 *
 * Covers the three things the scan route must never get wrong: read the
 * shorthand correctly, refuse what it should refuse, and — when no vision
 * key is configured — say so instead of inventing medicines.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const IMG = path.join(process.cwd(), "public", "sample-prescription.png");

// Sign in once; every route below is behind auth (401 without a cookie).
const login = await fetch(BASE + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
});
const cookie = login.headers.getSetCookie()?.[0]?.split(";")[0] ?? "";
if (!login.ok || !cookie) {
  console.error("FAIL  could not sign in as the caregiver — is the server running?");
  process.exit(1);
}
console.log("PASS  caregiver signed in\n");
const authed = (p, init = {}) => fetch(BASE + p, { ...init, headers: { ...(init.headers ?? {}), cookie } });

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

// 1. Text path: shorthand parsing
{
  const res = await authed("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Tab Metformin 500mg 1-0-1 after food\nCap Pantoprazole 40mg BD before food\nInj Ceftriaxone 1g IV x 5 days",
    }),
  });
  const data = await res.json();
  const names = (data.medicines ?? []).map((m) => m.brand).join(", ");
  check("scan: text path returns 200", res.ok);
  check("scan: finds the 2 home medicine lines", data.medicines?.length === 2, `got ${data.medicines?.length} [${names}]`);
  check("scan: 1-0-1 means morning + night", data.medicines?.[0]?.times?.length === 2, JSON.stringify(data.medicines?.[0]?.times));
  check("scan: pantoprazole before food", data.medicines?.[1]?.relationToFood === "before", data.medicines?.[1]?.relationToFood);
  check(
    "scan: hospital-only line is separated out",
    (data.ignored ?? []).length >= 1,
    JSON.stringify((data.ignored ?? []).map((i) => i.reason ?? i.text ?? i)),
  );
}

// 2. Empty text
{
  const res = await authed("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "   " }),
  });
  check("scan: empty text rejected 400", res.status === 400, String(res.status));
}

// 3. Image path: with no vision key the route must say so honestly, not pretend
{
  const form = new FormData();
  const buf = fs.readFileSync(IMG);
  form.append("file", new Blob([buf], { type: "image/png" }), "sample-prescription.png");
  const res = await authed("/api/scan", { method: "POST", body: form });
  const data = await res.json();
  check("scan: image upload accepted", res.ok, String(res.status));
  check("scan: falls back to browser OCR when no key", data.mode === "needs-text", `mode=${data.mode}`);
  check("scan: fallback message is honest", /OCR|vision/i.test(data.message ?? ""), data.message);
  check(
    "scan: no medicines hallucinated without a reader",
    Array.isArray(data.medicines) && data.medicines.length === 0,
    `count=${data.medicines?.length}`,
  );
}

// 4. Reject what it should
{
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "evil.txt");
  const res = await authed("/api/scan", { method: "POST", body: form });
  check("scan: non-image file rejected 415", res.status === 415, String(res.status));

  const form2 = new FormData();
  form2.append("file", new Blob([Buffer.alloc(9 * 1024 * 1024)], { type: "image/png" }), "huge.png");
  const res2 = await authed("/api/scan", { method: "POST", body: form2 });
  check("scan: >8MB rejected before reading", res2.status === 413, String(res2.status));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
