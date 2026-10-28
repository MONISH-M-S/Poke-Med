import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { now } from "@/lib/clock";
import { buildState } from "@/lib/state";
import { rejectRevokedElder } from "@/lib/elder-guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = await rejectRevokedElder();
  if (blocked) return blocked;

  let body: { doseId?: unknown; action?: unknown; actor?: unknown };
  try {
    body = (await req.json()) as { doseId?: unknown; action?: unknown; actor?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.doseId !== "string" || !body.doseId) {
    return NextResponse.json({ error: "Dose required" }, { status: 400 });
  }

  const result = await mutate(async (db) => {
    const dose = db.doses.find((d) => d.id === body.doseId);
    if (!dose) return { ok: false as const, error: "Dose not found" };

    if (body.action === "taken") {
      dose.status = "taken";
      dose.actedAt = now().toISOString();
      dose.actedBy = body.actor === "caregiver" ? "caregiver" : "elder";
      db.alerts = db.alerts.filter((a) => a.doseId !== dose.id);
    } else if (body.action === "snooze") {
      const next = new Date(now().getTime() + 10 * 60_000);
      dose.scheduledAt = next.toISOString();
      dose.status = "due";
      db.alerts = db.alerts.filter((a) => a.doseId !== dose.id);
    } else {
      return { ok: false as const, error: "Unknown action" };
    }

    return { ok: true as const, state: buildState(db) };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.state);
}
