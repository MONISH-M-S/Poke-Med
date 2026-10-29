"use client";

import ReportView from "@/components/ReportView";
import type { SharedReport as SharedReportData } from "@/lib/types";

/** Read-only report shown after a one-time doctor link is opened. */
export default function SharedReport({ report }: { report: SharedReportData }) {
  const first = report.week.days[0]?.date;
  const last = report.week.days[report.week.days.length - 1]?.date;
  const range = (d?: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

  return (
    <div className="container-app py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Shared medication report</p>
          <h1 className="h1 mt-1">
            {report.elderName}&apos;s week{" "}
            <span className="font-normal text-muted">
              · {range(first)} – {range(last)}
            </span>
          </h1>
          <p className="muted mt-2">A read-only record shared by the family caregiver.</p>
        </div>
        {/* The heading prints — a filed copy needs the name and the date range.
            Only the control itself is screen-only. */}
        <button className="btn-primary self-start sm:self-auto print:hidden" onClick={() => window.print()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print / save as PDF
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        Generated {new Date(report.generatedAt).toLocaleString("en-IN")}.
        {/* Provenance prints, so a filed copy still says when it was produced.
            The link-state note is only meaningful on screen. */}
        <span className="print:hidden"> This one-time link is now used. No changes can be made from this page.</span>
      </p>

      <ReportView week={report.week} />
    </div>
  );
}
