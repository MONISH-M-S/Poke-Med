"use client";

import Link from "next/link";
import { useState } from "react";
import { postJSON, useAppState, clockNote } from "@/lib/client";
import { StatusPill, FoodNote, Empty } from "@/components/ui";
import type { AppState, DoseView } from "@/lib/types";

export default function Dashboard() {
  const { state, setState, error } = useAppState();
  const [nudge, setNudge] = useState<string | null>(null);

  async function markTaken(dose: DoseView) {
    const next = await postJSON<AppState>("/api/doses", {
      doseId: dose.id,
      action: "taken",
      actor: "caregiver",
    });
    setState(next);
  }

  async function nudgeElder() {
    setNudge("A reminder is now showing on Lakshmi's screen.");
    setTimeout(() => setNudge(null), 4000);
  }

  if (error) {
    return (
      <div className="container-app py-16">
        <div className="card p-6">
          <h1 className="h1">Could not load the dashboard</h1>
          <p className="muted mt-2">{error}</p>
          <button className="btn-primary mt-4" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="container-app py-16">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-line" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card h-64 animate-pulse lg:col-span-2" />
          <div className="card h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  const { elder, caregiver, today, week, flags, alerts } = state;
  const takenCount = today.filter((d) => d.status === "taken").length;
  const missedCount = today.filter((d) => d.status === "missed").length;
  const dateLabel = new Date(state.now).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const demoNote = clockNote(state.offsetMinutes);
  const openFlags = flags.filter((f) => f.status === "open");
  const hour = new Date(state.now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const groups = (["Morning", "Afternoon", "Night"] as const).map((bucket) => ({
    bucket,
    items: today.filter((d) => d.bucket === bucket),
  }));

  return (
    <div className="container-app py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">
            {dateLabel} · Caregiver view
            {demoNote ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-warn">{demoNote}</span> : null}
          </p>
          <h1 className="h1 mt-1">{greeting}, {caregiver.name}</h1>
          <p className="muted mt-1">
            Watching over {elder.name}&apos;s medicines from {caregiver.city}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/elder" className="btn-ghost">
            Open {elder.name}&apos;s screen
          </Link>
          <Link href="/upload" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            New prescription
          </Link>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-alert text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6ZM10.5 19a2 2 0 0 0 3 0"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-alert">
                  {alerts.length === 1 ? "1 dose wasn’t confirmed" : `${alerts.length} doses weren’t confirmed`}
                </p>
                {alerts.slice(0, 2).map((a) => (
                  <p key={a.id} className="mt-1 text-sm text-red-900/80">
                    {a.message}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn-ghost" onClick={nudgeElder}>
                Send a nudge
              </button>
              {alerts[0]?.doseId && (
                <button
                  className="btn-danger"
                  onClick={() => {
                    const dose = today.find((d) => d.id === alerts[0].doseId);
                    if (dose) markTaken(dose);
                  }}
                >
                  Mark as taken
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {nudge && (
        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
          {nudge}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Today */}
        <section className="card p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="h2">Today</h2>
            <p className="text-sm text-muted">
              <strong className="text-ink">{takenCount}</strong> of {today.length} taken
              {missedCount > 0 && <span className="text-alert"> · {missedCount} missed</span>}
            </p>
          </div>

          {today.length === 0 ? (
            <div className="mt-4">
              <Empty>No doses scheduled yet. Upload a prescription to build the schedule.</Empty>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {groups.map(({ bucket, items }) =>
                items.length === 0 ? null : (
                  <div key={bucket}>
                    <p className="label mb-2">{bucket}</p>
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                      {items.map((dose) => (
                        <li key={dose.id} className="flex items-center gap-3 bg-white px-4 py-3">
                          <span className="w-[74px] shrink-0 text-sm font-bold tabular-nums text-ink">
                            {dose.time}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {dose.brand} {dose.strength}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                              {dose.doseLabel} <FoodNote rel={dose.relationToFood} />
                            </span>
                          </span>
                          <StatusPill status={dose.status} />
                          {dose.status !== "taken" && (
                            <button
                              className="hidden rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-paper sm:inline-flex"
                              onClick={() => markTaken(dose)}
                            >
                              Mark taken
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          {/* Adherence */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="h2">This week</h2>
              <Link href="/report" className="text-sm font-semibold text-brand-700 hover:underline">
                Full report →
              </Link>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-5xl font-extrabold tracking-tight text-ink">{week.percent}%</span>
              <span className="pb-1.5 text-sm text-muted">of doses taken</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {week.taken} taken · {week.missed} missed · {week.total} scheduled
            </p>

            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {week.days.map((d) => {
                const full = d.taken + d.missed;
                const tone =
                  full === 0
                    ? "bg-line"
                    : d.missed === 0
                      ? "bg-brand-500"
                      : d.missed > d.taken
                        ? "bg-alert"
                        : "bg-amber-400";
                return (
                  <div key={d.date} className="text-center">
                    <div className={`h-12 rounded-md ${tone}`} title={`${d.taken} taken, ${d.missed} missed`} />
                    <span className="mt-1 block text-[10px] font-semibold text-muted">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Flags */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="h2">Pharmacist review</h2>
              <span className={`pill ${openFlags.length ? "bg-amber-100 text-warn" : "bg-paper text-muted"}`}>
                {openFlags.length} open
              </span>
            </div>
            {openFlags.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No conflicts flagged for this prescription.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {openFlags.slice(0, 4).map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/flags/${f.id}`}
                      className="flex items-start gap-2 rounded-xl border border-line px-3 py-2.5 hover:bg-paper"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          f.severity === "high" ? "bg-alert" : "bg-amber-500"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{f.title}</span>
                        <span className="block text-xs text-muted">Open for pharmacist review →</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] leading-snug text-muted">
              Decision support, not medical advice. Flags are for a pharmacist to review.
            </p>
          </section>

          {/* Medicines */}
          <section className="card p-5 sm:p-6">
            <h2 className="h2">Medicines</h2>
            <ul className="mt-3 space-y-3">
              {state.medicines.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {m.brand} {m.strength}
                    </p>
                    <p className="text-xs text-muted">
                      {m.doseLabel} ·{" "}
                      {m.prn ? "only when needed" : m.times.map((t) => timeFromHHMM(t)).join(", ")}
                    </p>
                  </div>
                  {m.prn && <span className="pill bg-paper text-muted">PRN</span>}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function timeFromHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
