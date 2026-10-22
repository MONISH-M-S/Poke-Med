import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { verifySecret } from "@/lib/auth-hash";
import { signSession } from "@/lib/auth-token";
import { COOKIE_NAME, SESSION_DAYS } from "@/lib/demo-auth";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

// Small in-memory throttle: 8 failed attempts per IP per 5 minutes.
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < Date.now()) return false;
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

  const role: Role | null =
    body.mode === "elder" ? "elder" : body.mode === "caregiver" ? "caregiver" : null;

  if (!role) {
    return NextResponse.json({ error: "Choose whose PIN this is." }, { status: 400 });
  }

  const db = readDB();
  const person = db.people.find((p) => p.role === role);
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
