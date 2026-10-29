import type { AppState } from "@/lib/types";
import { StatusPill, Empty } from "@/components/ui";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * The report cards, shared by the caregiver's report page and the public
 * one-time doctor link. Read-only by design: no dose actions live here.
 */
export default function ReportView({ week }: { week: AppState["week"] }) {
  return (
    <>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-1">
          <p className="label">Doses taken</p>
          <p className="mt-2 text-6xl font-extrabold tracking-tight text-ink">{week.percent}%</p>
          <p className="mt-1 text-sm text-muted">
            {week.taken} of {week.total} scheduled doses
          </p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${week.percent}%` }} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-brand-50 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <CheckIcon size={13} />
                Taken
              </dt>
              <dd className="text-xl font-bold text-brand-900">{week.taken}</dd>
            </div>
            <div className="rounded-xl bg-red-50 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-alert">
                <AlertIcon size={13} />
                Missed
              </dt>
              <dd className="text-xl font-bold text-alert">{week.missed}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] leading-snug text-muted">
            A dose counts as taken only when it is confirmed. Unconfirmed doses are marked missed 60 minutes after the
            scheduled time.
          </p>
        </section>

        <section className="card p-6 lg:col-span-2">
          <h2 className="h2">Day by day</h2>
          {week.days.every((d) => d.total === 0) ? (
            <Empty className="mt-4">No doses scheduled this week. Upload a prescription to build the schedule.</Empty>
          ) : (
            <ul className="mt-4 space-y-3">
              {week.days.map((d) => {
                const total = d.taken + d.missed;
                const pct = total === 0 ? 0 : Math.round((d.taken / total) * 100);
                const dayColor = d.missed === 0 ? "bg-brand-500" : "bg-amber-400";
                // The glyph repeats what the bar colour says, so a reader who
                // cannot separate the colours still gets it.
                const mark =
                  total === 0 ? null : d.missed === 0 ? (
                    <CheckIcon size={14} />
                  ) : (
                    <AlertIcon size={14} />
                  );
                return (
                  <li key={d.date} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-bold text-muted">{d.label}</span>
                    <span className="w-14 text-xs tabular-nums text-muted">
                      {new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${dayColor} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="flex w-20 items-center justify-end gap-1 text-right text-xs font-semibold">
                      {mark && <span className={d.missed ? "text-warn" : "text-brand-700"}>{mark}</span>}
                      <span className={d.missed ? "text-warn" : "text-muted"}>
                        {total === 0 ? "—" : `${d.taken}/${total}`}
                        {d.missed > 0 ? ` · ${d.missed} missed` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-[11px] text-muted">
            Bars show the share of scheduled doses confirmed each day.
          </p>
        </section>
      </div>

      <section className="card mt-5 p-6">
        <h2 className="h2">Missed doses</h2>
        {week.missedList.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-brand-50 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
              <CheckIcon size={18} strokeWidth={2.6} />
            </span>
            <span className="text-sm font-semibold text-brand-700">
              Nothing missed in the last seven days. Great job!
            </span>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {week.missedList.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-28 text-sm font-semibold text-ink">
                  {new Date(d.dateKey + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="w-20 text-sm tabular-nums text-muted">{d.time}</span>
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {d.brand} {d.strength} <span className="text-muted">· {d.doseLabel}</span>
                </span>
                <StatusPill status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 rounded-xl border border-line bg-surface px-5 py-4 text-xs leading-relaxed text-muted">
        <strong className="text-ink">About this report.</strong> It reflects what was confirmed in PokéMed, not a
        clinical assessment. A missed dose in this report may have been taken without confirmation. Decision support,
        not medical advice — speak to the prescriber or pharmacist about any changes.
      </div>
    </>
  );
}
