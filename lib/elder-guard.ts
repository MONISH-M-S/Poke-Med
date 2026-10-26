import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "./auth-token";
import { isElderSessionRevoked } from "./pairing";
import { COOKIE_NAME, ELDER_COOKIE_NAME } from "./demo-auth";

/**
 * A removed device keeps its signed cookie until the cookie expires, and an
 * HMAC token cannot be unsigned. So the caregiver's "Remove" puts the session
 * id on a deny-list, and the endpoints that serve elder data check it here.
 *
 * Caregivers are never blocked — they may have both cookies in one browser.
 */
export async function rejectRevokedElder(): Promise<NextResponse | null> {
  const store = await cookies();

  const caregiver = await verifySession(store.get(COOKIE_NAME)?.value);
  if (caregiver?.role === "caregiver") return null;

  const elder = await verifySession(store.get(ELDER_COOKIE_NAME)?.value);
  if (elder?.role === "elder" && isElderSessionRevoked(elder.sid)) {
    const res = NextResponse.json(
      { error: "This device was removed. Ask your family to pair it again." },
      { status: 401 },
    );
    res.cookies.set(ELDER_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }

  return null;
}
