import { cookies } from "next/headers";
import { verifySession } from "./auth-token";
import type { Session } from "./auth-token";

export async function getServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pokemed_session")?.value;
  return verifySession(token);
}

export async function getElderServerSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pokemed_elder_session")?.value;
  return verifySession(token);
}