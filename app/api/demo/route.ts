import { NextResponse } from "next/server";
import { mutate, resetDB, readDB, mutateSync } from "@/lib/db";
import { setClockOffset } from "@/lib/clock";
import { buildState, GRACE_MINUTES, sweep } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { action?: string; minutes?: number };

  if (body.action === "reset") {
    const db = resetDB();
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

  if (body.action === "offset" && typeof body.minutes === "number") {
    const db = await mutate(async (d) => {
      d.clockOffsetMinutes = Math.round(body.minutes!);
      return d;
    });
    setClockOffset(body.minutes);
    return NextResponse.json(buildState(db));
  }

  if (body.action === "nextDose") {
    // Move the clock just before the next unconfirmed dose, so it reads as due now.
    const db = readDB();
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
      return d;
    });
    setClockOffset(minutes);
    sweep(next);
    return NextResponse.json(buildState(next));
  }

  if (body.action === "nextMiss") {
    // Move the clock just past the grace window of the next unconfirmed dose.
    const db = readDB();
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
      return d;
    });
    setClockOffset(minutes);
    sweep(next);

    return NextResponse.json(buildState(next));
  }

  return NextResponse.json({ error: "Unknown demo action" }, { status: 400 });
}
