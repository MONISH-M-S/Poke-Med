import assert from "node:assert/strict";
import { parseSig, parsePrescription, parsePrescriptionText } from "../lib/parse/sig";
import { detectFlags } from "../lib/checks";
import { saltsFor, suggestBrand } from "../lib/data/brands";
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

ok("a written clock time wins over the guessed slot", () => {
  const r = parseSig("Cap. Pan 40mg 1 OD AC 7 AM");
  assert.deepEqual(r.times, ["06:30"]);
  assert.match(r.decidedBy, /written time/);
});

ok("8hrly becomes a three-times-a-day schedule", () => {
  const r = parseSig("Tab. X 500mg 8hrly x 5 days");
  assert.deepEqual(r.times, ["08:00", "16:00"]);
});

ok("1/2 is a half tablet, not a blood pressure", () => {
  const r = parseSig("Tab. X 5mg 1/2-0-1/2 PC");
  assert.equal(r.unitsPerDose, 0.5);
  assert.equal(r.times.length, 2);
});

ok("a date is not a dose pattern", () => {
  const r = parseSig("Tab. X 5mg 17-7-24");
  assert.equal(r.times.length, 1);
});

ok("a count before BD is the number of tablets", () => {
  const r = parseSig("Tab. X 500mg 2 BD PC");
  assert.equal(r.unitsPerDose, 2);
  assert.equal(r.times.length, 2);
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

ok("Cap. Pan 40 fills in 40 mg from the name", () => {
  const meds = parsePrescriptionText("Cap. Pan 40 1 OD AC 7 AM");
  assert.equal(meds.length, 1);
  assert.equal(meds[0].brand, "Pan");
  assert.equal(meds[0].strength, "40 mg");
  assert.match(meds[0].notes.join(" "), /check it/i);
});

ok("hospital IVs and supplies are reported, never scheduled", () => {
  const parsed = parsePrescription(`IV Flagyl 500mg x1 Stat
5ml Syringe 3
Normal Saline 500ml Stat
Tab. Pan 40 1 OD AC 7 AM`);
  assert.equal(parsed.medicines.length, 1);
  assert.equal(parsed.medicines[0].brand, "Pan");
  assert.equal(parsed.ignored.length, 3);
  assert.match(parsed.ignored[0].reason, /clinician/);
  assert.match(parsed.ignored[1].reason, /supply/);
});

ok("a near-miss brand gets a question, not a silent rename", () => {
  const meds = parsePrescriptionText("Tab. Ecosprln 75mg 1-0-0 AC x 30 days");
  assert.equal(meds[0].brand, "Ecosprln");
  assert.match(meds[0].notes.join(" "), /Ecosprin/);
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

console.log("\nIndian product index");

ok("Dolo resolves to paracetamol from the 253k-product index", () => {
  const r = saltsFor("Dolo");
  assert.deepEqual(r.salts, ["paracetamol"]);
  assert.equal(r.known, true);
});

ok("Combiflam resolves to ibuprofen + paracetamol", () => {
  const r = saltsFor("Combiflam");
  assert.deepEqual([...r.salts].sort(), ["ibuprofen", "paracetamol"]);
  assert.equal(r.known, true);
});

ok("Augmentin resolves to amoxicillin + clavulanate", () => {
  const r = saltsFor("Augmentin");
  assert.deepEqual([...r.salts].sort(), ["amoxicillin", "clavulanate"]);
});

ok("a plain brand is not given a combination variant's extra salt", () => {
  assert.deepEqual(saltsFor("Ecosprin").salts, ["aspirin"]);
  assert.deepEqual(saltsFor("Glycomet").salts, ["metformin"]);
});

ok("a hyphenated variant keeps its own composition", () => {
  assert.deepEqual([...saltsFor("Ecosprin-AV").salts].sort(), ["aspirin", "atorvastatin"]);
});

ok("an unknown token is kept but marked for review", () => {
  const r = saltsFor("Zzzznotadrug");
  assert.deepEqual(r.salts, ["zzzznotadrug"]);
  assert.equal(r.known, false);
});

ok("an OCR typo suggests the real brand without replacing it", () => {
  assert.equal(suggestBrand("Ecosprln"), "ecosprin");
});

console.log("\nDrugBank interactions");

ok("metformin with cimetidine raises a sourced interaction flag", () => {
  const met = med({ id: "met", brand: "Glycomet", salt: ["metformin"] });
  const cim = med({ id: "cim", brand: "Cimetidine", salt: ["cimetidine"] });
  const withBoth = { ...db, medicines: [met, cim] } as DB;
  const flags = detectFlags(withBoth, "p1", ["cim"]);
  const flag = flags.find((f) => f.kind === "pair" && /DrugBank/i.test(f.sourceName));
  assert.ok(flag, "expected a DrugBank-sourced interaction flag");
  assert.match(flag!.title.toLowerCase(), /glycomet/);
  assert.match(flag!.explanation, /serum concentration/i);
});

ok("a curated pair is not duplicated by the dataset", () => {
  const flags = detectFlags(db, "p1", ["ibuprofen"]);
  const duplicates = flags.filter(
    (f) => /DrugBank/i.test(f.sourceName) && /ibuprofen \+ aspirin/i.test(f.explanation),
  );
  assert.equal(duplicates.length, 0);
});

console.log(`\n${passed} checks passed.\n`);
