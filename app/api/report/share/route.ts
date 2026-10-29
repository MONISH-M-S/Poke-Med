import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { verifySession } from "@/lib/auth-token";
import { createReportShare, REPORT_SHARE_TTL_MS } from "@/lib/report-share";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get("pokemed_session")?.value);

  if (!session || session.role !== "caregiver") {
    return NextResponse.json({ error: "Caregiver only" }, { status: 403 });
  }

  const { readDB } = await import("@/lib/db");
  const db = await readDB();
  const elder = db.people.find((p) => p.role === "elder" && p.linkedTo === session.pid);
  if (!elder) {
    return NextResponse.json({ error: "No elder linked" }, { status: 404 });
  }

  const { token } = await createReportShare(elder.id);
  const reportUrl = `${requestOrigin(req)}/share/report/${token}`;
  // The QR contains a bearer token for a medical report. Generate it locally so
  // the URL never goes to a third-party QR image service.
  const qr = await QRCode.toDataURL(reportUrl, {
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return NextResponse.json(
    {
      reportUrl,
      qr,
      expiresIn: REPORT_SHARE_TTL_MS / 1000,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
