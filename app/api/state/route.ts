import { NextResponse } from "next/server";
import { getState } from "@/lib/state";
import { rejectRevokedElder } from "@/lib/elder-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const blocked = await rejectRevokedElder();
  if (blocked) return blocked;

  return NextResponse.json(await getState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
