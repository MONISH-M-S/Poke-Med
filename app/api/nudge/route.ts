import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-token";
import { mutate } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/demo-auth";

export const dynamic = "force-dynamic";

/** Caregiver-only: put a short reminder on the elder's screen. */
export async function POST() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(COOKIE_NAME)?.value);

  if (!session || session.role !== "caregiver") {
    return NextResponse.json({ error: "Caregiver only" }, { status: 403 });
  }

  const nudge = { at: Date.now(), from: session.name };
  await mutate((db) => {
    db.lastNudge = nudge;
  });

  return NextResponse.json({ ok: true, data: nudge });
}
