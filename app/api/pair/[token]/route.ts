import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { consumePairingToken, createElderSession } from "@/lib/pairing";
import { signElderSession } from "@/lib/auth-token";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const origin = requestOrigin(req);

  const elderId = consumePairingToken(token);
  if (!elderId) {
    return NextResponse.redirect(new URL("/pair/invalid", origin));
  }

  // Get elder name from DB
  const { readDB } = await import("@/lib/db");
  const db = readDB();
  const elder = db.people.find((p) => p.id === elderId);
  if (!elder) {
    return NextResponse.redirect(new URL("/pair/invalid", origin));
  }

  // Create long-lived JWT session for the elder (180 days)
  const exp = Date.now() + 180 * 24 * 60 * 60 * 1000;
  const sessionToken = await signElderSession(elderId, elder.name, exp);

  // Also store in memory for the paired devices list
  createElderSession(elderId, "Paired via QR");

  // Set httpOnly cookie. Only mark it secure when the app is really served over https.
  const cookieStore = await cookies();
  cookieStore.set("pokemed_elder_session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 180 * 24 * 60 * 60, // 180 days
    secure: origin.startsWith("https://"),
  });

  // Redirect to elder screen
  return NextResponse.redirect(new URL("/elder", origin));
}