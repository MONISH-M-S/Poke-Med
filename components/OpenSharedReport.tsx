"use client";

import { useState } from "react";
import SharedReport from "@/components/SharedReport";
import type { SharedReport as SharedReportData } from "@/lib/types";

/**
 * The QR lands here first. Opening the report is a deliberate POST, so a
 * scanner's link preview (or a chat app fetching the URL) cannot consume it.
 */
export default function OpenSharedReport({ token }: { token: string }) {
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function openReport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/share/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.report) {
        setError("This report link is invalid, has expired, or has already been opened.");
        return;
      }
      setReport(data.report as SharedReportData);
    } catch {
      setError("Could not open the report. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (report) return <SharedReport report={report} />;

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-5 py-12">
      <div className="card w-full max-w-md p-7 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M14 3h7v7M21 3l-9 9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 21H3v-7M3 21l9-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="label mt-5">PokéMed</p>
        <h1 className="h1 mt-1">One-time report link</h1>
        <p className="muted mt-3">
          A family caregiver has shared a seven-day medication report with you. For privacy, this link can be opened
          only once.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-alert" role="alert">
            {error}
          </p>
        )}

        <button className="btn-primary mt-5 w-full" onClick={() => void openReport()} disabled={busy || Boolean(error)}>
          {busy ? "Opening report…" : "View report"}
        </button>
        <p className="mt-3 text-[11px] leading-snug text-muted">
          No sign-in is needed. If the link has expired or already been used, ask the caregiver to create a new one.
        </p>
      </div>
    </div>
  );
}
