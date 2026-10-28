import { NextResponse } from "next/server";
import { mutate, resetDB, readDB } from "@/lib/db";
import { setClockOffset } from "@/lib/clock";
import { buildState, GRACE_MINUTES, sweep } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { action?: unknown; minutes?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; minutes?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "reset") {
    const db = await resetDB();
    return NextResponse.json(buildState(db));
  }

  if (body.action === "realTime") {
    const db = await mutate(async (d) => {
      d.clockOffsetMinutes = 0;
      return d;
    });
    setClockOffset(0);
    return NextResponse.json(buildState(db));
  }

  if (body.action === "offset" && typeof body.minutes === "number" && Number.isFinite(body.minutes)) {
    const minutes = Math.round(body.minutes);
    const db = await mutate(async (d) => {
      d.clockOffsetMinutes = minutes;
      return d;
    });
    setClockOffset(minutes);
    return NextResponse.json(buildState(db));
  }

  if (body.action === "nextDose") {
    // Move the clock just before the next unconfirmed dose, so it reads as due now.
    const db = await readDB();
    const realNow = Date.now();
    const due = db.doses
      .filter((d) => d.status === "due")
      .map((d) => ({ dose: d, at: new Date(d.scheduledAt).getTime() }))
      .sort((a, b) => a.at - b.at);
    const target = due.find((c) => c.at > realNow) ?? due[0];
    if (!target) return NextResponse.json({ ...buildState(db), notice: "No doses left to show." });

    const minutes = (target.at + 60_000 - realNow) / 60_000;
    const next = await mutate(async (d) => {
      d.clockOffsetMinutes = Math.round(minutes);
      setClockOffset(d.clockOffsetMinutes);
      // Sweep inside the mutation so the missed alerts are actually persisted.
      sweep(d);
      return d;
    });
    return NextResponse.json(buildState(next));
  }

  if (body.action === "nextMiss") {
    // Move the clock just past the grace window of the next unconfirmed dose.
    const db = await readDB();
    const realNow = Date.now();
    const candidates = db.doses
      .filter((d) => d.status === "due")
      .map((d) => ({ dose: d, at: new Date(d.scheduledAt).getTime() }))
      .sort((a, b) => a.at - b.at);

    const target = candidates.find((c) => c.at > realNow - 12 * 3600_000) ?? candidates[0];
    if (!target) {
      return NextResponse.json({ ...buildState(db), notice: "Nothing left to miss today." });
    }

    const desired = target.at + GRACE_MINUTES * 60_000 + 60_000;
    const minutes = (desired - realNow) / 60_000;
    const next = await mutate(async (d) => {
      d.clockOffsetMinutes = Math.round(minutes);
      setClockOffset(d.clockOffsetMinutes);
      sweep(d);
      return d;
    });

    return NextResponse.json(buildState(next));
  }

  return NextResponse.json({ error: "Unknown demo action" }, { status: 400 });
}
