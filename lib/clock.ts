// One clock for the whole app. The demo panel moves it; nothing else does.
//
// The offset lives on globalThis on purpose: Next.js bundles each route
// separately, so a module-level variable would give every route its own clock.
const g = globalThis as unknown as { __pokemedClockOffset?: number };

export function setClockOffset(minutes: number) {
  g.__pokemedClockOffset = Math.round(minutes);
}

export function getClockOffset() {
  return g.__pokemedClockOffset ?? 0;
}

/** Current time, including any demo offset. Always use this instead of Date.now(). */
export function now(): Date {
  return new Date(Date.now() + getClockOffset() * 60_000);
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateKeyOffset(days: number, from = now()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

export function atTime(dateKey: string, hhmm: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function isoTimeLabel(iso: string): string {
  const d = new Date(iso);
  const period = d.getHours() >= 12 ? "PM" : "AM";
  const hour = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${hour}:${String(d.getMinutes()).padStart(2, "0")} ${period}`;
}

export function bucketOf(hhmm: string): "Morning" | "Afternoon" | "Night" {
  const h = Number(hhmm.split(":")[0]);
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Night";
}

export function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short" });
}
