const BASE = "http://localhost:3000";

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function get(path) {
  const res = await fetch(BASE + path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const RX = `Tab. Dolo 650mg          1-1-1 PC      x 3 days
Tab. Ibuprofen 400mg     BD PC         x 3 days
Tab. Metformin 500mg     1-0-1 PC      x 30 days`;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

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
console.log("\n" + results.filter((r) => r.pass).length + "/" + results.length + " passed");
if (results.some((r) => !r.pass)) process.exit(1);
