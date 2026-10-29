"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppState } from "@/lib/client";
import ReportView from "@/components/ReportView";
import { ReportSkeleton } from "@/components/Skeleton";

type ShareState = {
  open: boolean;
  loading?: boolean;
  url?: string;
  qr?: string;
  expiresIn?: number;
  error?: string;
};

export default function ReportPage() {
  const { state, error } = useAppState(10000);
  const [share, setShare] = useState<ShareState>({ open: false });

  if (error) return <div className="container-app py-16 text-center"><p className="text-alert">{error}</p></div>;
  if (!state) return <ReportSkeleton />;

  const { week, elder } = state;
  const first = week.days[0]?.date;
  const last = week.days[week.days.length - 1]?.date;
  const range = (d?: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

  async function createShare() {
    setShare({ open: true, loading: true });
    try {
      const res = await fetch("/api/report/share", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reportUrl) {
        setShare({ open: true, error: data.error ?? "Could not create a share link." });
        return;
      }
      setShare({
        open: true,
        url: data.reportUrl,
        qr: data.qr,
        expiresIn: data.expiresIn,
      });
    } catch {
      setShare({ open: true, error: "Could not reach the server. Try again." });
    }
  }

  return (
    <div className="container-app py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <p className="label">Caregiver report</p>
          <h1 className="h1 mt-1">
            {elder.name}&apos;s week <span className="font-normal text-muted">· {range(first)} – {range(last)}</span>
          </h1>
          <p className="muted mt-2">Seven days of dose history, as recorded.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="btn-ghost">
            Dashboard
          </Link>
          <button className="btn-primary" onClick={() => void createShare()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM21 14v3M14 21h3M18 21h3" />
            </svg>
            Share with doctor
          </button>
          <button className="btn-ghost" onClick={() => window.print()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / save as PDF
          </button>
        </div>
      </div>

      <ReportView week={week} />

      {share.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden"
          onClick={() => setShare({ open: false })}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-report-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="share-report-title" className="h2">Share with doctor</h2>
              <button
                className="text-muted hover:text-ink"
                aria-label="Close"
                onClick={() => setShare({ open: false })}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-2 text-sm text-muted">
              Ask the doctor to scan this code. It opens a read-only copy of this week&apos;s report. The link can be
              opened once and expires in {Math.max(1, Math.round((share.expiresIn ?? 600) / 60))} minutes.
            </p>

            {share.loading ? (
              <div className="mt-6 grid place-items-center rounded-xl border border-line bg-paper p-8">
                <p className="text-sm text-muted">Preparing a one-time link…</p>
              </div>
            ) : share.error ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-alert" role="alert">
                {share.error}
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="rounded-xl border border-line bg-white p-4">
                  {share.qr ? (
                    <img src={share.qr} alt="One-time report QR code" className="mx-auto" />
                  ) : (
                    <p className="text-xs text-muted">The QR code could not be prepared.</p>
                  )}
                </div>
                {share.url && <p className="break-all text-center text-xs text-muted">{share.url}</p>}
                <p className="text-center text-[11px] leading-snug text-muted">
                  The report page does not need a caregiver sign-in. For privacy, it stays read-only and the link stops
                  working after one opening.
                </p>
              </div>
            )}

            <button className="btn-ghost mt-5 w-full" onClick={() => setShare({ open: false })}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
