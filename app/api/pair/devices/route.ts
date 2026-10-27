import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-token";
import { listElderSessions, revokeElderSession } from "@/lib/pairing";

export const dynamic = "force-dynamic";

async function getCaregiverSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pokemed_session")?.value;
  const session = await verifySession(token);
  if (!session || session.role !== "caregiver") return null;

  const { readDB } = await import("@/lib/db");
  const db = await readDB();
  const elder = db.people.find((p) => p.role === "elder" && p.linkedTo === session.pid);
  return { session, elder };
}

export async function GET() {
  const auth = await getCaregiverSession();
  if (!auth) {
    return NextResponse.json({ error: "Caregiver only" }, { status: 403 });
  }
  if (!auth.elder) {
    return NextResponse.json({ error: "No elder linked" }, { status: 404 });
  }

  const sessions = await listElderSessions(auth.elder.id);
  return NextResponse.json({
    ok: true,
    data: sessions.map((s) => ({
      token: s.token,
      createdAt: s.createdAt,
      deviceInfo: s.deviceInfo || "Unknown device",
    })),
  });
}

export async function DELETE(req: Request) {
  const auth = await getCaregiverSession();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Caregiver only" }, { status: 403 });
  }

  const body = await req.json();
  const { token } = body;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Session token required" }, { status: 400 });
  }

  const revoked = await revokeElderSession(token);
  if (!revoked) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { revoked: true } });
}