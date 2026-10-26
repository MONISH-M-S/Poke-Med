import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "./lib/auth-token";
import { COOKIE_NAME, ELDER_COOKIE_NAME } from "./lib/demo-auth";

/**
 * Two doors, one app.
 * - Caregiver signs in with PIN (cookie: pokemed_session)
 * - Elder NEVER enters a PIN — they scan a QR code and get a long-lived session (cookie: pokemed_elder_session)
 * - This middleware enforces that separation.
 * - Both cookies are JWTs signed with the same secret.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static files (sample photo, images) never need a session.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return NextResponse.next();

  const caregiverSession = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  const elderSession = await verifySession(req.cookies.get(ELDER_COOKIE_NAME)?.value);

  // Login page — only for caregivers
  if (pathname === "/login") {
    const switching = req.nextUrl.searchParams.get("switch") === "1";
    if (caregiverSession && !switching) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (elderSession && !switching) {
      return NextResponse.redirect(new URL("/elder", req.url));
    }
    return NextResponse.next();
  }

  // Pairing endpoints — public (no auth needed)
  if (pathname.startsWith("/pair") || pathname.startsWith("/api/pair")) {
    return NextResponse.next();
  }

  // Auth endpoints — public
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const isApi = pathname.startsWith("/api");

  // Elder routes — require elder session cookie
  if (pathname.startsWith("/elder")) {
    if (!elderSession) {
      if (isApi) {
        return NextResponse.json({ error: "Please pair your phone first." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/pair/invalid", req.url));
    }
    // Elder can only access their own screen and allowed APIs
    if (isApi) {
      const allowedApi = pathname === "/api/state" || pathname === "/api/doses" || pathname === "/api/auth/me";
      if (!allowedApi) {
        return NextResponse.json({ error: "Not available on this screen." }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // Elder session on non-elder paths — redirect to elder screen
  if (elderSession && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/elder", req.url));
  }

  // Elder API access — allow elder session for state/doses even from non-/elder paths
  if (isApi && elderSession) {
    const allowedApi = pathname === "/api/state" || pathname === "/api/doses" || pathname === "/api/auth/me";
    if (allowedApi) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Not available on this screen." }, { status: 403 });
  }

  // Everything else (dashboard, upload, report, etc.) — requires caregiver session
  if (!caregiverSession) {
    if (isApi) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Caregiver can access everything including elder preview
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};