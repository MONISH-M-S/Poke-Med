import { NextResponse } from "next/server";
import { mutate, newId } from "@/lib/db";
import { localDateKey, now } from "@/lib/clock";
import { addDaysKey, generateDoses } from "@/lib/doses";
import { detectFlags } from "@/lib/checks";
import { buildState } from "@/lib/state";
import type { ExtractedMedicine, Medicine } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_HORIZON_DAYS = 30;

export async function POST(req: Request) {
  const body = (await req.json()) as { medicines?: ExtractedMedicine[]; rawText?: string };
  const incoming = body.medicines ?? [];
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "No medicines to save." }, { status: 400 });
  }

  const result = await mutate(async (db) => {
    const elder = db.people.find((p) => p.role === "elder")!;
    const today = localDateKey(now());
    const horizon = addDaysKey(today, MAX_HORIZON_DAYS);
    const createdIds: string[] = [];
    let updated = 0;

    for (const raw of incoming) {
      const brand = (raw.brand || "").trim();
      if (!brand) continue;
      if (!raw.salt?.length) continue;

      const saltKey = [...raw.salt].sort().join("+");
      const existing = db.medicines.find(
        (m) =>
          m.personId === elder.id &&
          [...m.salt].sort().join("+") === saltKey &&
          m.brand.toLowerCase() === brand.toLowerCase() &&
          m.prn === raw.prn,
      );

      const endDate = raw.prn
        ? null
        : raw.durationDays
          ? addDaysKey(today, Math.max(0, raw.durationDays - 1))
          : horizon;

      if (existing) {
        existing.times = raw.times;
        existing.doseLabel = raw.doseLabel;
        existing.relationToFood = raw.relationToFood;
        existing.strength = raw.strength ?? existing.strength;
        existing.rawSig = raw.rawSig || existing.rawSig;
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
        salt: raw.salt,
        strength: raw.strength,
        form: raw.form || "tablet",
        doseLabel: raw.doseLabel || "1 tablet",
        times: raw.times ?? [],
        relationToFood: raw.relationToFood ?? null,
        prn: Boolean(raw.prn),
        startDate: today,
        endDate,
        rawSig: raw.rawSig || "",
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
      rawText: body.rawText ?? "",
      status: "saved",
      createdAt: now().toISOString(),
    });

    return { created: createdIds.length, updated, flags: added, state: buildState(db) };
  });

  return NextResponse.json(result);
}
