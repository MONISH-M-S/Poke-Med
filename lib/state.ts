import type { AppState, DB, DoseEvent, DoseView, DayStat } from "./types";
import { mutate } from "./db";
import { bucketOf, dayLabel, isoTimeLabel, localDateKey, now } from "./clock";
import { addDaysKey } from "./doses";

export const GRACE_MINUTES = 60;

/** Anything unconfirmed past the grace window becomes missed, once. */
export function sweep(db: DB) {
  const current = now();
  const cutoff = current.getTime() - GRACE_MINUTES * 60_000;
  const recentCutoff = current.getTime() - 24 * 60 * 60_000;

  for (const dose of db.doses) {
    if (dose.status !== "due") continue;
    const when = new Date(dose.scheduledAt).getTime();
    if (when > cutoff) continue;

    dose.status = "missed";

    if (when < recentCutoff) continue;
    if (db.alerts.some((a) => a.doseId === dose.id)) continue;

    const med = db.medicines.find((m) => m.id === dose.medicineId);
    db.alerts.push({
      id: `alr_${dose.id}`,
      personId: dose.personId,
      doseId: dose.id,
      message: `${med?.brand ?? "A dose"}${med?.strength ? ` ${med.strength}` : ""} at ${isoTimeLabel(dose.scheduledAt)} was not confirmed.`,
      createdAt: current.toISOString(),
      acknowledged: false,
    });
  }
}

function toView(db: DB, dose: DoseEvent): DoseView | null {
  const med = db.medicines.find((m) => m.id === dose.medicineId);
  if (!med) return null;
  const when = new Date(dose.scheduledAt);
  const dateKey = localDateKey(when);
  const hhmm = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  return {
    id: dose.id,
    medicineId: med.id,
    brand: med.brand,
    strength: med.strength,
    form: med.form,
    doseLabel: med.doseLabel,
    time: isoTimeLabel(dose.scheduledAt),
    dateKey,
    scheduledAt: dose.scheduledAt,
    status: dose.status,
    bucket: bucketOf(hhmm),
    relationToFood: med.relationToFood,
    actedAt: dose.actedAt,
    actedBy: dose.actedBy,
  };
}

export function buildState(db: DB): AppState {
  const elder = db.people.find((p) => p.role === "elder")!;
  const caregiver = db.people.find((p) => p.role === "caregiver")!;
  const current = now();
  const todayKey = localDateKey(current);

  const views = db.doses
    .map((d) => toView(db, d))
    .filter((v): v is DoseView => Boolean(v));

  const today = views
    .filter((v) => v.dateKey === todayKey)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const days: DayStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = addDaysKey(todayKey, -i);
    const dayDoses = views.filter((v) => v.dateKey === key && v.status !== "due");
    days.push({
      date: key,
      label: dayLabel(key),
      taken: dayDoses.filter((d) => d.status === "taken").length,
      missed: dayDoses.filter((d) => d.status === "missed").length,
      total: dayDoses.length,
    });
  }

  const taken = days.reduce((n, d) => n + d.taken, 0);
  const missed = days.reduce((n, d) => n + d.missed, 0);
  const total = taken + missed;

  const missedList = views
    .filter((v) => v.status === "missed")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .slice(0, 30);

  const nextDose =
    today.find((v) => v.status === "due") ??
    views
      .filter((v) => v.status === "due" && v.scheduledAt > current.toISOString())
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ??
    null;

  return {
    now: current.toISOString(),
    offsetMinutes: db.clockOffsetMinutes,
    elder,
    caregiver,
    medicines: db.medicines.filter((m) => m.personId === elder.id),
    today,
    week: {
      percent: total === 0 ? 100 : Math.round((taken / total) * 100),
      taken,
      missed,
      total,
      days,
      missedList,
    },
    flags: db.flags.filter((f) => f.personId === elder.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    alerts: db.alerts
      .filter((a) => a.personId === elder.id && !a.acknowledged)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    nextDose,
  };
}

export function getState(): AppState {
  return mutate((db) => {
    sweep(db);
    return buildState(db);
  });
}
