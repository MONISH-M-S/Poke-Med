import { NextResponse } from "next/server";
import { getState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
