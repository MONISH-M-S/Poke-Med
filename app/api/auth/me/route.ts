import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth-token";
import { COOKIE_NAME } from "@/lib/demo-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ role: null }, { status: 401 });

  return NextResponse.json({ role: session.role, name: session.name, pid: session.pid });
}
