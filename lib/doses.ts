import type { DoseEvent, Medicine } from "./types";
import { atTime, localDateKey } from "./clock";

function eachDate(fromKey: string, toKey: string): string[] {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(localDateKey(d));
  }
  return out;
}

export function generateDoses(med: Medicine, fromKey: string, toKey: string): DoseEvent[] {
  if (med.prn || med.times.length === 0) return [];
  const start = med.startDate > fromKey ? med.startDate : fromKey;
  const end = med.endDate && med.endDate < toKey ? med.endDate : toKey;
  if (start > end) return [];

  const out: DoseEvent[] = [];
  for (const day of eachDate(start, end)) {
    for (const time of med.times) {
      out.push({
        id: `dose_${med.id}_${day}_${time.replace(":", "")}`,
        personId: med.personId,
        medicineId: med.id,
        scheduledAt: atTime(day, time).toISOString(),
        status: "due",
      });
    }
  }
  return out;
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}
