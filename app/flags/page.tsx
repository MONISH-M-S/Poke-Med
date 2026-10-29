"use client";

import Link from "next/link";
import { useAppState } from "@/lib/client";
import { AlertIcon, ClockIcon } from "@/components/icons";

export default function FlagsPage() {
  const { state } = useAppState(10000);
  if (!state) return <div className="container-app py-16 text-sm text-muted">Loading…</div>;

  const flags = state.flags;
  return (
    <div className="container-app py-8">
      <p className="label">Safety review</p>
      <h1 className="h1 mt-1">Flagged for a pharmacist</h1>
      <p className="muted mt-2 max-w-2xl">
        PokéMed checks the prescription against the medicines already on the list, then against a short, cited list of
        known risky pairs. It doesn&apos;t decide anything — it asks a professional to look.
      </p>

      {flags.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm font-semibold text-ink">Nothing flagged.</p>
          <p className="muted mt-1">Scan a prescription to run the checks.</p>
          <Link href="/upload" className="btn-primary mt-4">
            Add a prescription
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {flags.map((f) => (
            <li key={f.id}>
              <Link href={`/flags/${f.id}`} className="card flex items-start gap-3 p-5 hover:border-brand-500">
                {/* Severity marker repeats the pill's wording as a shape, not just a colour. */}
                <span
                  className={`mt-1 shrink-0 ${f.severity === "high" ? "text-alert" : "text-warn"}`}
                  aria-hidden="true"
                >
                  {f.severity === "high" ? <AlertIcon size={18} strokeWidth={2.2} /> : <ClockIcon size={18} strokeWidth={2.2} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{f.title}</span>
                    <span
                      className={`pill ${f.severity === "high" ? "bg-red-50 text-alert" : "bg-amber-50 text-warn"}`}
                    >
                      {f.severity === "high" ? "Higher priority" : "Moderate"}
                    </span>
                    {f.status === "sent" && <span className="pill bg-brand-50 text-brand-700">Sent to pharmacist</span>}
                  </span>
                  <span className="mt-1 block text-sm text-muted">{f.explanation}</span>
                  <span className="mt-1 block text-xs text-muted">Source: {f.sourceName}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted">Decision support, not medical advice.</p>
    </div>
  );
}
