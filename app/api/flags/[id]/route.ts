import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";
import { buildState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const state = await mutate(async (db) => {
    const flag = db.flags.find((f) => f.id === id);
    if (flag) flag.status = "sent";
    return buildState(db);
  });

  return NextResponse.json(state);
}
