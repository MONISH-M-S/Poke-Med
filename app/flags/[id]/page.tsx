"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { postJSON, useAppState } from "@/lib/client";
import type { AppState } from "@/lib/types";

export default function FlagDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, setState } = useAppState(15000);
  const [busy, setBusy] = useState(false);

  if (!state) return <div className="container-app py-16 text-sm text-muted">Loading…</div>;

  const flag = state.flags.find((f) => f.id === params.id);
  if (!flag) {
    return (
      <div className="container-app py-16">
        <div className="card max-w-lg p-6">
          <h1 className="h1">That flag no longer exists</h1>
          <p className="muted mt-2">It may have been cleared when the demo was reset.</p>
          <Link href="/" className="btn-primary mt-5">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const meds = state.medicines.filter((m) => flag.medicineIds.includes(m.id));

  async function send() {
    if (!flag) return;
    setBusy(true);
    try {
      const next = await postJSON<AppState>(`/api/flags/${flag.id}`, {});
      setState(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-app py-8">
      <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">
        ← Dashboard
      </Link>

      <div className="mt-4 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`pill ${flag.severity === "high" ? "bg-red-50 text-alert" : "bg-amber-50 text-warn"}`}
          >
            {flag.severity === "high" ? "Higher priority" : "Moderate"}
          </span>
          <span className="pill bg-amber-100 text-warn">Flagged for pharmacist review</span>
          {flag.status === "sent" && <span className="pill bg-brand-50 text-brand-700">Sent to pharmacist</span>}
        </div>

        <h1 className="h1 mt-3">{flag.title}</h1>
        <p className="mt-3 text-base leading-relaxed text-ink">{flag.explanation}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="label">Medicines involved</p>
            <ul className="mt-2 space-y-2">
              {meds.map((m) => (
                <li key={m.id} className="text-sm text-ink">
                  <span className="font-semibold">
                    {m.brand} {m.strength}
                  </span>
                  <span className="block text-xs text-muted">
                    {m.salt.join(" + ")} · {m.doseLabel}
                    {m.prn ? " · only when needed" : ` · ${m.times.join(", ")}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <p className="label">Where this comes from</p>
            <p className="mt-2 text-sm font-semibold text-ink">{flag.sourceName}</p>
            <a
              href={flag.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm font-semibold text-brand-700 underline"
            >
              Open the source
            </a>
            <p className="mt-3 text-[11px] leading-snug text-muted">
              PokéMed keeps a short, curated list of known risky pairs and compares active ingredients, not brand
              names. It is not a complete drug-interaction database.
            </p>
          </div>
        </div>

        <div className="card mt-4 p-5">
          <p className="label">What happens next</p>
          <ol className="mt-2 space-y-2 text-sm text-ink">
            <li>1. Send this to the pharmacist with the medicine list attached.</li>
            <li>2. Keep taking the medicines as prescribed until a professional advises otherwise.</li>
            <li>3. The caregiver sees the outcome on the dashboard.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={send} disabled={busy || flag.status === "sent"}>
              {flag.status === "sent" ? "Sent to pharmacist" : busy ? "Sending…" : "Send to pharmacist"}
            </button>
            <Link href="/report" className="btn-ghost">
              See the medicine list
            </Link>
          </div>
        </div>

        <p className="mt-5 rounded-xl border border-line bg-white px-4 py-3 text-xs leading-relaxed text-muted">
          <strong className="text-ink">Decision support, not medical advice.</strong> This flag is a prompt to check
          with a pharmacist. It is not a diagnosis and it is not an instruction to stop or change a medicine. In this
          prototype, “send to pharmacist” records a review request; no pharmacist is connected yet.
        </p>
      </div>
    </div>
  );
}
