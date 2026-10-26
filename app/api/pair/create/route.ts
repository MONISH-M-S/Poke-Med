import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-token";
import { createPairingToken } from "@/lib/pairing";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pokemed_session")?.value;
  const session = await verifySession(token);

  if (!session || session.role !== "caregiver") {
    return NextResponse.json({ error: "Caregiver only" }, { status: 403 });
  }

  const { readDB } = await import("@/lib/db");
  const db = readDB();
  const elder = db.people.find((p) => p.role === "elder" && p.linkedTo === session.pid);
  if (!elder) {
    return NextResponse.json({ error: "No elder linked" }, { status: 404 });
  }

  const pairingToken = createPairingToken(elder.id);
  const pairingUrl = `${requestOrigin(req)}/api/pair/${pairingToken}`;

  return NextResponse.json({ token: pairingToken, pairingUrl, expiresIn: 5 * 60 });
}