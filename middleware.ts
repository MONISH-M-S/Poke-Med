import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "./lib/auth-token";
import { COOKIE_NAME } from "./lib/demo-auth";

/**
 * Two doors, one app.
 * - The elder's PIN session can only reach /elder, /api/state and /api/doses.
 * - The caregiver's session can reach everything, including a preview of /elder.
 * This is a prototype gate, not a hardened identity system.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static files (sample photo, images) never need a session.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);

  if (pathname === "/login") {
    const switching = req.nextUrl.searchParams.get("switch") === "1";
    if (session && !switching) {
      return NextResponse.redirect(new URL(session.role === "elder" ? "/elder" : "/", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const isApi = pathname.startsWith("/api");

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (session.role === "elder") {
    const allowedApi =
      pathname === "/api/state" || pathname === "/api/doses" || pathname === "/api/auth/me";
    if (isApi && !allowedApi) {
      return NextResponse.json({ error: "Not available on this screen." }, { status: 403 });
    }
    if (!isApi && !pathname.startsWith("/elder")) {
      return NextResponse.redirect(new URL("/elder", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
