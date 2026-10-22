import assert from "node:assert/strict";
import { parseSig, parsePrescriptionText } from "../lib/parse/sig";
import { detectFlags } from "../lib/checks";
import type { DB, Medicine } from "../lib/types";

let passed = 0;
function ok(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log("  ✓ " + name);
  } catch (e) {
    console.error("  ✗ " + name);
    throw e;
  }
}

console.log("\nShorthand decoder");

ok("1-0-1 PC becomes morning and night, after food", () => {
  const r = parseSig("Tab. Metformin 500mg 1-0-1 PC x 30 days");
  assert.deepEqual(r.times, ["08:30", "20:30"]);
  assert.equal(r.relationToFood, "after");
  assert.equal(r.durationDays, 30);
});

ok("1-1-1 becomes three doses", () => {
  const r = parseSig("Tab. Dolo 650mg 1-1-1 PC x 3 days");
  assert.equal(r.times.length, 3);
  assert.equal(r.durationDays, 3);
});

ok("0-0-1 HS is a single night dose", () => {
  const r = parseSig("Tab. Atorvastatin 10mg 0-0-1 HS x 30 days");
  assert.deepEqual(r.times, ["21:00"]);
});

ok("BD means twice a day", () => {
  const r = parseSig("Tab. Ibuprofen 400mg BD PC");
  assert.deepEqual(r.times, ["08:30", "20:30"]);
});

ok("TDS means three times a day", () => {
  const r = parseSig("Cap. Amoxicillin 500mg TDS PC x 5 days");
  assert.equal(r.times.length, 3);
  assert.equal(r.durationDays, 5);
});

ok("SOS is never scheduled at fixed times", () => {
  const r = parseSig("Tab. Crocin 500mg SOS");
  assert.equal(r.prn, true);
  assert.deepEqual(r.times, []);
});

ok("Q6H spaces doses through the day", () => {
  const r = parseSig("Tab. X 500mg Q6H");
  assert.deepEqual(r.times, ["08:00", "14:00", "20:00"]);
});

ok("half tablets survive", () => {
  const r = parseSig("Tab. X 5mg ½-0-½ PC");
  assert.equal(r.unitsPerDose, 0.5);
  assert.equal(r.times.length, 2);
});

ok("AC shifts before meals", () => {
  const r = parseSig("Tab. Amlodipine 5mg 1-0-0 AC");
  assert.deepEqual(r.times, ["07:30"]);
});

console.log("\nPrescription lines");

const sample = `Tab. Dolo 650mg          1-1-1 PC      x 3 days
Tab. Ibuprofen 400mg     BD PC         x 3 days
Tab. Metformin 500mg     1-0-1 PC      x 30 days`;

ok("reads three medicines from the demo prescription", () => {
  const meds = parsePrescriptionText(sample);
  assert.equal(meds.length, 3);
  assert.equal(meds[0].brand, "Dolo");
  assert.deepEqual(meds[0].salt, ["paracetamol"]);
  assert.equal(meds[1].brand, "Ibuprofen");
  assert.deepEqual(meds[1].salt, ["ibuprofen"]);
  assert.equal(meds[2].durationDays, 30);
});

ok("ignores clinic header lines", () => {
  const meds = parsePrescriptionText(`Dr. R. Kumar, MBBS\nPatient: Lakshmi, Age 72\n\nTab. Amlodipine 5mg 1-0-0 AC x 30 days`);
  assert.equal(meds.length, 1);
});

console.log("\nSafety checks");

function med(over: Partial<Medicine>): Medicine {
  return {
    id: Math.random().toString(36).slice(2),
    personId: "p1",
    brand: "X",
    salt: ["x"],
    form: "tablet",
    doseLabel: "1 tablet",
    times: ["08:00"],
    relationToFood: null,
    prn: false,
    startDate: "2026-01-01",
    endDate: null,
    rawSig: "",
    addedBy: "scan",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const crocin = med({ id: "crocin", brand: "Crocin", salt: ["paracetamol"], prn: true, times: [] });
const dolo = med({ id: "dolo", brand: "Dolo", salt: ["paracetamol"], prn: true, times: [] });
const aspirin = med({ id: "aspirin", brand: "Ecosprin", salt: ["aspirin"] });
const ibuprofen = med({ id: "ibuprofen", brand: "Ibuprofen", salt: ["ibuprofen"] });

const db = {
  version: 1,
  people: [],
  medicines: [crocin, dolo, aspirin, ibuprofen],
  doses: [],
  flags: [],
  alerts: [],
  prescriptions: [],
  clockOffsetMinutes: 0,
} as unknown as DB;

ok("duplicate paracetamol is flagged across brands", () => {
  const flags = detectFlags(db, "p1", ["dolo"]);
  const dup = flags.find((f) => f.kind === "duplicate");
  assert.ok(dup, "expected a duplicate flag");
  assert.match(dup!.title.toLowerCase(), /paracetamol/);
});

ok("ibuprofen with aspirin is flagged", () => {
  const flags = detectFlags(db, "p1", ["ibuprofen"]);
  assert.ok(flags.some((f) => f.kind === "pair" && /bleeding|aspirin/i.test(f.title + f.explanation)));
});

ok("no flag when only one medicine is involved", () => {
  const solo = { ...db, medicines: [med({ id: "solo", brand: "Metformin", salt: ["metformin"] })] } as DB;
  const flags = detectFlags(solo, "p1", ["solo"]);
  assert.equal(flags.length, 0);
});

console.log(`\n${passed} checks passed.\n`);
