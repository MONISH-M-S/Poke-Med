import { NextResponse } from "next/server";
import { consumeReportShare } from "@/lib/report-share";
import { getState } from "@/lib/state";
import type { SharedReport } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public, single-use redemption. The report is read-only and contains only the
 * shared week summary — no caregiver data, session details or secrets.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const elderId = await consumeReportShare(token);
  if (!elderId) {
    return NextResponse.json(
      { error: "This report link is invalid, has expired, or has already been opened." },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const state = await getState();
  if (state.elder.id !== elderId) {
    return NextResponse.json(
      { error: "This report link is no longer available." },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const report: SharedReport = {
    elderName: state.elder.name,
    generatedAt: new Date().toISOString(),
    week: state.week,
  };

  return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
}
