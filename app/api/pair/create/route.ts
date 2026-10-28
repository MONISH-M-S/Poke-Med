import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";
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
  const db = await readDB();
  const elder = db.people.find((p) => p.role === "elder" && p.linkedTo === session.pid);
  if (!elder) {
    return NextResponse.json({ error: "No elder linked" }, { status: 404 });
  }

  const pairingToken = await createPairingToken(elder.id);
  const pairingUrl = `${requestOrigin(req)}/api/pair/${pairingToken}`;
  // Generate the QR here, not through a third-party image service: the URL
  // contains a single-use token that grants access to the elder's screen.
  const qr = await QRCode.toDataURL(pairingUrl, {
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return NextResponse.json({ token: pairingToken, pairingUrl, qr, expiresIn: 5 * 60 });
}