import { NextResponse } from "next/server";
import { mutate, newId } from "@/lib/db";
import { localDateKey, now } from "@/lib/clock";
import { addDaysKey, generateDoses } from "@/lib/doses";
import { detectFlags } from "@/lib/checks";
import { buildState } from "@/lib/state";
import type { Medicine } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_HORIZON_DAYS = 30;
const MAX_TEXT_CHARS = 100_000;

type Incoming = {
  brand?: unknown;
  salt?: unknown;
  strength?: unknown;
  form?: unknown;
  doseLabel?: unknown;
  times?: unknown;
  relationToFood?: unknown;
  prn?: unknown;
  durationDays?: unknown;
  rawSig?: unknown;
};

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asTimes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is string => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
  );
}

function asFood(value: unknown): "before" | "after" | "with" | null {
  return value === "before" || value === "after" || value === "with" ? value : null;
}

export async function POST(req: Request) {
  let body: { medicines?: unknown; rawText?: unknown };
  try {
    body = (await req.json()) as { medicines?: unknown; rawText?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const incoming = Array.isArray(body.medicines) ? body.medicines : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "No medicines to save." }, { status: 400 });
  }
  const hasUsable = incoming.some((item) => {
    if (!item || typeof item !== "object") return false;
    const raw = item as Incoming;
    return (
      asText(raw.brand).trim().length > 0 &&
      Array.isArray(raw.salt) &&
      raw.salt.some((s) => typeof s === "string" && s.trim().length > 0)
    );
  });
  if (!hasUsable) {
    return NextResponse.json({ error: "No valid medicines to save." }, { status: 400 });
  }
  const rawText = asText(body.rawText).slice(0, MAX_TEXT_CHARS);

  const result = await mutate(async (db) => {
    const elder = db.people.find((p) => p.role === "elder")!;
    const today = localDateKey(now());
    const horizon = addDaysKey(today, MAX_HORIZON_DAYS);
    const createdIds: string[] = [];
    let updated = 0;

    for (const item of incoming) {
      const raw = (item ?? {}) as Incoming;
      const brand = asText(raw.brand).trim();
      const salt = Array.isArray(raw.salt)
        ? raw.salt.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [];
      if (!brand || salt.length === 0) continue;

      const prn = Boolean(raw.prn);
      const times = asTimes(raw.times);
      const durationDays =
        typeof raw.durationDays === "number" && Number.isFinite(raw.durationDays)
          ? Math.max(0, Math.min(365, Math.floor(raw.durationDays)))
          : null;
      const strength = asText(raw.strength).trim() || undefined;
      const form = asText(raw.form).trim() || "tablet";
      const doseLabel = asText(raw.doseLabel).trim() || "1 tablet";
      const relationToFood = asFood(raw.relationToFood);
      const rawSig = asText(raw.rawSig);

      const saltKey = [...salt].sort().join("+");
      const existing = db.medicines.find(
        (m) =>
          m.personId === elder.id &&
          [...m.salt].sort().join("+") === saltKey &&
          m.brand.toLowerCase() === brand.toLowerCase() &&
          m.prn === prn,
      );

      const endDate = prn
        ? null
        : durationDays && durationDays > 0
          ? addDaysKey(today, Math.max(0, durationDays - 1))
          : horizon;

      if (existing) {
        existing.times = times;
        existing.doseLabel = doseLabel;
        existing.relationToFood = relationToFood;
        existing.strength = strength ?? existing.strength;
        existing.rawSig = rawSig || existing.rawSig;
        existing.endDate = endDate;

        const nowIso = now().toISOString();
        db.doses = db.doses.filter(
          (d) => !(d.medicineId === existing.id && d.status === "due" && d.scheduledAt >= nowIso),
        );
        const existingIds = new Set(db.doses.map((d) => d.id));
        const cutoff = now().getTime() - 5 * 60_000;
        db.doses.push(
          ...generateDoses(existing, today, horizon).filter(
            (d) => !existingIds.has(d.id) && new Date(d.scheduledAt).getTime() >= cutoff,
          ),
        );
        updated += 1;
        continue;
      }

      const med: Medicine = {
        id: newId("med"),
        personId: elder.id,
        brand,
        salt,
        strength,
        form,
        doseLabel,
        times,
        relationToFood,
        prn,
        startDate: today,
        endDate,
        rawSig,
        addedBy: "scan",
        createdAt: now().toISOString(),
      };

      db.medicines.push(med);
      const cutoff = now().getTime() - 5 * 60_000;
      db.doses.push(
        ...generateDoses(med, today, horizon).filter((d) => new Date(d.scheduledAt).getTime() >= cutoff),
      );
      createdIds.push(med.id);
    }

    const fresh = detectFlags(db, elder.id, createdIds);
    const added = [];
    for (const flag of fresh) {
      const duplicate = db.flags.find(
        (f) =>
          f.personId === flag.personId &&
          f.kind === flag.kind &&
          [...f.medicineIds].sort().join("+") === [...flag.medicineIds].sort().join("+"),
      );
      if (!duplicate) {
        db.flags.push(flag);
        added.push(flag);
      }
    }

    db.prescriptions.push({
      id: newId("rx"),
      personId: elder.id,
      rawText,
      status: "saved",
      createdAt: now().toISOString(),
    });

    return { created: createdIds.length, updated, flags: added, state: buildState(db) };
  });

  return NextResponse.json(result);
}
