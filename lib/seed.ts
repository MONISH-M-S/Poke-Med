import type { DB, Medicine } from "./types";
import { atTime, dateKeyOffset, now } from "./clock";
import { generateDoses } from "./doses";
import { hashSecret } from "./auth-hash";
import { DEMO_CAREGIVER_PIN, DEMO_PIN } from "./demo-auth";
import { newId } from "./db";

/**
 * Seeded demo world. Synthetic data only — no real patients.
 * A realistic week of history so the adherence report has something to say.
 */
export function buildSeed(): DB {
  const today = dateKeyOffset(0);
  const sixDaysAgo = dateKeyOffset(-6);
  const tomorrow = dateKeyOffset(1);

  const base = (over: Partial<Medicine>): Medicine => ({
    id: newId("med"),
    personId: "el_lakshmi",
    brand: "Medicine",
    salt: [],
    form: "tablet",
    doseLabel: "1 tablet",
    times: [],
    relationToFood: null,
    prn: false,
    startDate: sixDaysAgo,
    endDate: null,
    rawSig: "",
    addedBy: "seed",
    createdAt: new Date().toISOString(),
    ...over,
  });

  const medicines: Medicine[] = [
    base({
      id: newId("med"),
      brand: "Metformin",
      salt: ["metformin"],
      strength: "500 mg",
      times: ["08:00", "20:00"],
      relationToFood: "after",
      doseLabel: "1 tablet",
      rawSig: "Tab. Metformin 500 mg   1-0-1 PC   x 30 days",
    }),
    base({
      id: newId("med"),
      brand: "Amlodipine",
      salt: ["amlodipine"],
      strength: "5 mg",
      times: ["08:00"],
      relationToFood: "before",
      doseLabel: "1 tablet",
      rawSig: "Tab. Amlodipine 5 mg   1-0-0 AC   x 30 days",
    }),
    base({
      id: newId("med"),
      brand: "Atorvastatin",
      salt: ["atorvastatin"],
      strength: "10 mg",
      times: ["21:00"],
      doseLabel: "1 tablet",
      rawSig: "Tab. Atorvastatin 10 mg   0-0-1 HS   x 30 days",
    }),
    base({
      id: newId("med"),
      brand: "Ecosprin",
      salt: ["aspirin"],
      strength: "75 mg",
      times: ["08:30"],
      relationToFood: "after",
      doseLabel: "1 tablet",
      rawSig: "Tab. Ecosprin 75 mg   OD PC   x 30 days",
    }),
    base({
      id: newId("med"),
      brand: "Crocin",
      salt: ["paracetamol"],
      strength: "500 mg",
      times: [],
      prn: true,
      doseLabel: "1 tablet",
      rawSig: "Tab. Crocin 500 mg   SOS",
    }),
  ];

  const doses = medicines.flatMap((m) => generateDoses(m, sixDaysAgo, tomorrow));

  // A believable pattern: four missed doses across the week.
  const misses = new Set([
    `${dateKeyOffset(-5)}|20:00|${medicines[0].id}`,
    `${dateKeyOffset(-3)}|08:00|${medicines[1].id}`,
    `${dateKeyOffset(-2)}|21:00|${medicines[2].id}`,
    `${dateKeyOffset(-1)}|20:00|${medicines[0].id}`,
  ]);

  const current = now();

  for (const d of doses) {
    const when = new Date(d.scheduledAt);
    const [y, m, day] = [when.getFullYear(), String(when.getMonth() + 1).padStart(2, "0"), String(when.getDate()).padStart(2, "0")];
    const key = `${y}-${m}-${day}`;
    const hhmm = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
    const med = medicines.find((x) => x.id === d.medicineId)!;

    if (misses.has(`${key}|${hhmm}|${med.id}`)) {
      d.status = "missed";
      continue;
    }

    if (when < current) {
      d.status = "taken";
      d.actedAt = new Date(when.getTime() + 6 * 60_000).toISOString();
      d.actedBy = "elder";
    }
  }

  return {
    version: 1,
    people: [
      {
        id: "el_lakshmi",
        role: "elder",
        name: "Lakshmi",
        age: 72,
        city: "Chennai",
        linkedTo: "cg_arjun",
        language: "en",
        pinHash: hashSecret(DEMO_PIN),
      },
      {
        id: "cg_arjun",
        role: "caregiver",
        name: "Arjun",
        city: "Bengaluru",
        linkedTo: "el_lakshmi",
        language: "en",
        pinHash: hashSecret(DEMO_CAREGIVER_PIN),
      },
    ],
    medicines,
    doses,
    flags: [],
    alerts: [],
    prescriptions: [],
    clockOffsetMinutes: 0,
  };
}

export function todayAt(hhmm: string) {
  return atTime(dateKeyOffset(0), hhmm);
}
