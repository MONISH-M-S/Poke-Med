const BASE = "http://localhost:3000";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

let cookie = "";

function authHeaders(extra = {}) {
  return cookie ? { ...extra, cookie } : extra;
}

async function post(path, body, { auth = true } = {}) {
  const headers = auth
    ? authHeaders({ "Content-Type": "application/json" })
    : { "Content-Type": "application/json" };
  const res = await fetch(BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function get(path, { auth = true } = {}) {
  const res = await fetch(BASE + path, {
    cache: "no-store",
    headers: auth ? authHeaders() : {},
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function setCookieFrom(res) {
  const raw = res.headers.getSetCookie?.()[0] ?? res.headers.get("set-cookie") ?? "";
  return raw.split(";")[0];
}

// ---------------------------------------------------------------- sign-in gate

{
  const page = await fetch(BASE + "/", { redirect: "manual" });
  const location = page.headers.get("location") ?? "";
  check(
    "signed-out visitors are sent to the login page",
    page.status >= 300 && page.status < 400 && /\/login/.test(location),
    `${page.status} → ${location}`,
  );

  const api = await fetch(BASE + "/api/state", { cache: "no-store" });
  check("signed-out API calls get 401", api.status === 401, `status ${api.status}`);

  const wrong = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "elder", pin: "9999" }),
  });
  check("a wrong PIN is rejected", wrong.status === 401, `status ${wrong.status}`);

  const elder = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "elder", pin: "1234" }),
  });
  const elderBody = await elder.json();
  const elderCookie = setCookieFrom(elder);
  check(
    "the elder PIN opens only the elder session",
    elder.ok && elderBody.role === "elder" && Boolean(elderCookie),
    `role ${elderBody.role ?? "none"}`,
  );

  const elderState = await fetch(BASE + "/api/state", {
    cache: "no-store",
    headers: { cookie: elderCookie },
  });
  check("the elder session can read her own screen", elderState.status === 200, `status ${elderState.status}`);

  const elderDemo = await fetch(BASE + "/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: elderCookie },
    body: JSON.stringify({ action: "reset" }),
  });
  check(
    "the elder session cannot reach caregiver APIs",
    elderDemo.status === 403,
    `status ${elderDemo.status}`,
  );

  const crossover = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "caregiver", pin: "1234" }),
  });
  check(
    "the elder PIN cannot open the caregiver view",
    crossover.status === 401,
    `status ${crossover.status}`,
  );

  const caregiver = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "caregiver", pin: "2468" }),
  });
  const caregiverBody = await caregiver.json();
  cookie = setCookieFrom(caregiver);
  check(
    "the caregiver login returns a caregiver session",
    caregiver.ok && caregiverBody.role === "caregiver" && Boolean(cookie),
    `role ${caregiverBody.role ?? "none"}`,
  );

  const caregiverState = await fetch(BASE + "/api/state", {
    cache: "no-store",
    headers: authHeaders(),
  });
  check("the caregiver session can reach the dashboard", caregiverState.status === 200, `status ${caregiverState.status}`);
}

// ------------------------------------------------------------------ demo flow

const RX = `Tab. Dolo 650mg          1-1-1 PC      x 3 days
Tab. Ibuprofen 400mg     BD PC         x 3 days
Tab. Metformin 500mg     1-0-1 PC      x 30 days`;

let state = await post("/api/demo", { action: "reset" });
check("reset gives a seeded week", state.week.total > 20, `${state.week.percent}% over ${state.week.total} doses`);

const scan = await post("/api/scan", { text: RX });
check("scan parses three medicines", scan.medicines.length === 3, scan.medicines.map((m) => m.brand).join(", "));
check(
  "Dolo resolves to paracetamol",
  JSON.stringify(scan.medicines[0].salt) === JSON.stringify(["paracetamol"]),
  scan.medicines[0].salt.join("+"),
);
check("Ibuprofen is twice daily", scan.medicines[1].times.length === 2, scan.medicines[1].times.join(", "));
check("Dolo is a 3 day course", scan.medicines[0].durationDays === 3);

const before = await get("/api/state");
const commit = await post("/api/prescriptions/commit", {
  medicines: scan.medicines,
  rawText: RX,
});
state = commit.state;

check("created two new medicines, updated one", commit.created === 2 && commit.updated === 1, `created ${commit.created}, updated ${commit.updated}`);
check("duplicate paracetamol flagged", state.flags.some((f) => f.kind === "duplicate"), state.flags.map((f) => f.title).join(" | "));
check(
  "ibuprofen + aspirin flagged",
  state.flags.some((f) => f.kind === "pair" && /ibuprofen/i.test(f.title)),
  state.flags.filter((f) => f.kind === "pair").map((f) => f.title).join(" | "),
);
check("flags carry a named source", state.flags.every((f) => f.sourceName && f.sourceUrl));
check("today's schedule grew", state.today.length > before.today.length, `${before.today.length} → ${state.today.length} doses`);
check(
  "no duplicate dose rows",
  new Set(state.today.map((d) => d.id)).size === state.today.length,
  `${state.today.length} rows`,
);
const backDated = state.today.filter(
  (d) => new Date(d.scheduledAt).getTime() < Date.now() - 6 * 60_000 && d.status !== "taken",
);
check("a new prescription never creates past doses", backDated.length === 0, `${backDated.length} back-dated`);

const due = state.today.find((d) => d.status === "due");
if (due) {
  const after = await post("/api/doses", { doseId: due.id, action: "taken", actor: "elder" });
  check("taking a dose is recorded", after.today.find((d) => d.id === due.id)?.status === "taken", due.brand + " " + due.time);
} else {
  check("taking a dose is recorded", false, "no due dose to take");
}

const flagged = await post(`/api/flags/${state.flags[0].id}`, {});
check("flag can be sent to a pharmacist", flagged.flags.find((f) => f.id === state.flags[0].id)?.status === "sent");

const missed = await post("/api/demo", { action: "nextMiss" });
check("skipping ahead produces a missed dose and an alert", missed.week.missed > 0 && missed.alerts.length > 0, `${missed.alerts.length} alert(s)`);
check("alert message names the medicine", missed.alerts.length > 0 && /Metformin|Dolo|Ibuprofen|Amlodipine|Atorvastatin|Ecosprin/.test(missed.alerts[0].message), missed.alerts[0]?.message);

await post("/api/demo", { action: "reset" });
const next = await post("/api/demo", { action: "nextDose" });
check("jump to next dose makes one dose due", next.offsetMinutes !== 0 && Boolean(next.nextDose), next.nextDose?.brand + " " + next.nextDose?.time);

const afterJump = await get("/api/state");
check(
  "the demo clock is shared across requests",
  afterJump.offsetMinutes === next.offsetMinutes,
  `post ${next.offsetMinutes}m vs get ${afterJump.offsetMinutes}m`,
);

const real = await post("/api/demo", { action: "realTime" });
check("clock can return to real time", real.offsetMinutes === 0);

await post("/api/demo", { action: "reset" });

// ------------------------------------------------------------------- sign-out

{
  const out = await fetch(BASE + "/api/auth/logout", { method: "POST", headers: authHeaders() });
  const cleared = out.headers.getSetCookie?.()[0] ?? "";
  check("signing out clears the session cookie", out.ok && /pokemed_session=;/.test(cleared), `status ${out.status}`);

  const forged = await fetch(BASE + "/api/state", {
    cache: "no-store",
    headers: { cookie: "pokemed_session=forged.signature" },
  });
  check("a forged session cookie is rejected", forged.status === 401, `status ${forged.status}`);
}

console.log("\n" + results.filter((r) => r.pass).length + "/" + results.length + " passed");
if (results.some((r) => !r.pass)) process.exit(1);
