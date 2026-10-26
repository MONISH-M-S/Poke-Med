import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { verifySecret } from "@/lib/auth-hash";
import { signSession } from "@/lib/auth-token";
import { COOKIE_NAME, SESSION_DAYS } from "@/lib/demo-auth";

export const dynamic = "force-dynamic";

// Small in-memory throttle: 8 failed attempts per IP per 5 minutes.
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(ip: string): boolean {
  const nowMs = Date.now();
  // Keep the throttle table from growing without bound on a busy or hostile host.
  if (attempts.size > 1000) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt < nowMs) attempts.delete(key);
    }
  }
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < nowMs) return false;
  return entry.count >= 8;
}

function recordFailure(ip: string) {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + 5 * 60_000 });
    return;
  }
  entry.count += 1;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait five minutes and try again." },
      { status: 429 },
    );
  }

  let body: { mode?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Elder devices never sign in with a PIN — they pair with a QR code.
  if (body.mode === "elder") {
    return NextResponse.json(
      { error: "Elder devices pair with a QR code. There is no PIN." },
      { status: 400 },
    );
  }
  if (body.mode !== "caregiver") {
    return NextResponse.json({ error: "Sign in as a caregiver." }, { status: 400 });
  }

  const db = readDB();
  const person = db.people.find((p) => p.role === "caregiver");
  const valid = verifySecret(String(body.pin ?? ""), person?.pinHash);

  if (!person || !valid) {
    recordFailure(ip);
    return NextResponse.json({ error: "That PIN doesn't match. Try again." }, { status: 401 });
  }

  attempts.delete(ip);

  const token = await signSession({
    pid: person.id,
    role: person.role,
    name: person.name,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60_000,
  });

  const res = NextResponse.json({ role: person.role, name: person.name });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: req.headers.get("x-forwarded-proto") === "https",
  });
  return res;
}
