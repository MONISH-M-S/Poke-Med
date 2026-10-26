"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppState } from "@/lib/client";
import { StatusPill, FoodNote, Empty } from "@/components/ui";
import type { DoseView } from "@/lib/types";

export default function SchedulePage() {
  const { state, error } = useAppState();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(new URLSearchParams(window.location.search).get("saved") === "1");
  }, []);

  if (error) return <div className="container-app py-16 text-sm text-alert">{error}</div>;
  if (!state) return <div className="container-app py-16 text-sm text-muted">Loading the schedule…</div>;

  const groups = (["Morning", "Afternoon", "Night"] as const).map((bucket) => ({
    bucket,
    items: state.today.filter((d) => d.bucket === bucket),
  }));
  const openFlags = state.flags.filter((f) => f.status === "open");

  return (
    <div className="container-app py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Step 3 of 3 · Schedule</p>
          <h1 className="h1 mt-1">{state.elder.name}&apos;s day</h1>
          <p className="muted mt-2">
            Built from what the prescription said. Every dose below is now on {state.elder.name}&apos;s phone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="btn-ghost">
            Dashboard
          </Link>
        </div>
      </div>

      {saved && (
        <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
          <p className="text-sm font-bold text-brand-700">Saved. The schedule is live.</p>
          <p className="mt-1 text-sm text-brand-900/70">
            {state.medicines.filter((m) => m.addedBy === "scan").length} medicines came from the new prescription.
            Reminders and missed-dose alerts are switched on.
          </p>
        </div>
      )}

      {openFlags.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-warn">
            {openFlags.length} {openFlags.length === 1 ? "item needs" : "items need"} a pharmacist&apos;s eye
          </p>
          <ul className="mt-3 space-y-2">
            {openFlags.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/flags/${f.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5 hover:bg-amber-50"
                >
                  <span className="text-sm font-semibold text-ink">{f.title}</span>
                  <span className="shrink-0 text-xs font-bold text-warn">Review →</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-warn/80">
            Flagged for pharmacist review. Not a diagnosis, and not advice to stop a medicine.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="h2">Today&apos;s doses</h2>
          {state.today.length === 0 ? (
            <div className="mt-3">
              <Empty>No doses today.</Empty>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {groups.map(({ bucket, items }) =>
                items.length === 0 ? null : (
                  <div key={bucket}>
                    <p className="label mb-2">{bucket}</p>
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                      {items.map((dose) => (
                        <ScheduleRow key={dose.id} dose={dose} />
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="card p-5 sm:p-6">
            <h2 className="h2">All medicines</h2>
            <ul className="mt-3 space-y-3">
              {state.medicines.map((m) => (
                <li key={m.id} className="rounded-xl border border-line px-3 py-2.5">
                  <p className="text-sm font-semibold text-ink">
                    {m.brand} {m.strength}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {m.doseLabel} ·{" "}
                    {m.prn ? "only when needed" : m.times.map((t) => timeLabel(t)).join(", ")}
                    {m.endDate ? ` · until ${new Date(m.endDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted/70">{m.rawSig}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <p className="text-xs leading-relaxed text-muted">
              A reminder shows on {state.elder.name}&apos;s screen at each time. If a dose isn&apos;t confirmed within
              60 minutes, it is marked missed and you are alerted. Decision support, not medical advice.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ScheduleRow({ dose }: { dose: DoseView }) {
  return (
    <li className="flex items-center gap-3 bg-white px-4 py-3">
      <span className="w-[74px] shrink-0 text-sm font-bold tabular-nums text-ink">{dose.time}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">
          {dose.brand} {dose.strength}
        </span>
        <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {dose.doseLabel} <FoodNote rel={dose.relationToFood} />
        </span>
      </span>
      <StatusPill status={dose.status} />
    </li>
  );
}

function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
