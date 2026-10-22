"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJSON } from "@/lib/client";
import type { ExtractedMedicine } from "@/lib/types";

type Row = ExtractedMedicine & { key: string };

type Stored = {
  medicines: ExtractedMedicine[];
  rawText: string;
  image?: string | null;
  mode?: string;
  ignored?: { line: string; reason: string }[];
};

const BASE_TIMES = [
  { label: "Morning", time: "08:00", from: 0, to: 11.5 },
  { label: "Afternoon", time: "13:00", from: 11.5, to: 17 },
  { label: "Night", time: "20:00", from: 17, to: 24 },
];

function hourOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h + m / 60;
}

function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function ReviewPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [rawText, setRawText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<{ line: string; reason: string }[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("pokemed.scan");
      if (!stored) {
        setRows([]);
        return;
      }
      const parsed = JSON.parse(stored) as Stored;
      setRawText(parsed.rawText ?? "");
      setImage(parsed.image ?? null);
      setIgnored(parsed.ignored ?? []);
      setRows(
        parsed.medicines.map((m, i) => ({
          ...m,
          key: `row_${i}_${Math.random().toString(36).slice(2, 6)}`,
        })),
      );
    } catch {
      setRows([]);
    }
  }, []);

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? prev);
  }

  function toggleTime(row: Row, time: string) {
    const has = row.times.includes(time);
    const next = has ? row.times.filter((t) => t !== time) : [...row.times, time].sort();
    update(row.key, { times: next });
  }

  async function save() {
    if (!rows) return;
    setError(null);

    const cleaned = rows
      .filter((r) => r.brand.trim())
      .map(({ key, ...rest }) => ({
        ...rest,
        brand: rest.brand.trim(),
        times: rest.prn ? [] : [...new Set(rest.times)].sort(),
        durationDays: rest.durationDays && rest.durationDays > 0 ? rest.durationDays : null,
      }));

    if (cleaned.length === 0) {
      setError("Add at least one medicine with a name.");
      return;
    }
    const missingTime = cleaned.find((m) => !m.prn && m.times.length === 0);
    if (missingTime) {
      setError(`${missingTime.brand} needs at least one time, or mark it as “only when needed”.`);
      return;
    }

    setSaving(true);
    try {
      await postJSON("/api/prescriptions/commit", { medicines: cleaned, rawText });
      sessionStorage.removeItem("pokemed.scan");
      router.push("/schedule?saved=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the prescription.");
      setSaving(false);
    }
  }

  if (rows === null) {
    return (
      <div className="container-app py-16">
        <p className="text-sm text-muted">Loading the extracted lines…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="container-app py-16">
        <div className="card max-w-xl p-6">
          <h1 className="h1">Nothing to review</h1>
          <p className="muted mt-2">Start with a prescription photo or paste the lines in.</p>
          <Link href="/upload" className="btn-primary mt-5">
            Add a prescription
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Step 2 of 3</p>
          <h1 className="h1 mt-1">Check what we read</h1>
          <p className="muted mt-2 max-w-2xl">
            OCR is not perfect, and handwriting is harder. Correct anything that looks wrong. Nothing is scheduled
            until you confirm.
          </p>
        </div>
        <Link href="/upload" className="btn-ghost">
          Back
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <p className="label">The prescription</p>
            </div>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Uploaded prescription" className="max-h-[440px] w-full bg-white object-contain" />
            ) : (
              <p className="px-4 py-6 text-sm text-muted">No photo — the lines were typed in.</p>
            )}
          </div>

          <div className="card p-4">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowRaw((v) => !v)}
              aria-expanded={showRaw}
            >
              <span className="label">What the reader saw</span>
              <span className="text-xs font-semibold text-brand-700">{showRaw ? "Hide" : "Show"}</span>
            </button>
            {showRaw && (
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-paper p-3 text-[11px] leading-5 text-muted">
                {rawText || "—"}
              </pre>
            )}
          </div>

          {ignored.length > 0 && (
            <div className="card p-4">
              <p className="label">Not scheduled</p>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-muted">
                {ignored.map((item, index) => (
                  <li key={`${index}_${item.line}`}>
                    <span className="font-semibold text-ink">{item.line}</span>
                    <br />
                    {item.reason}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-snug text-muted">
                Hospital drips, injections and supplies are kept off the home schedule on purpose. If a clinician asked
                you to continue one at home, add it as a typed line.
              </p>
            </div>
          )}
        </aside>

        <section className="space-y-4">
          {rows.map((row, index) => {
            const unsure = row.confidence < 0.7 || row.notes.length > 0;
            return (
              <div key={row.key} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                      {index + 1}
                    </span>
                    <span className="label">Medicine</span>
                    {unsure && <span className="pill bg-amber-100 text-warn">Please check</span>}
                  </div>
                  <button
                    className="text-xs font-semibold text-muted hover:text-alert"
                    onClick={() => setRows((prev) => prev?.filter((r) => r.key !== row.key) ?? prev)}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">Name</span>
                    <input
                      className="field mt-1"
                      value={row.brand}
                      onChange={(e) => update(row.key, { brand: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">Strength</span>
                    <input
                      className="field mt-1"
                      value={row.strength ?? ""}
                      placeholder="e.g. 500 mg"
                      onChange={(e) => update(row.key, { strength: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">Dose each time</span>
                    <input
                      className="field mt-1"
                      value={row.doseLabel}
                      onChange={(e) => update(row.key, { doseLabel: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">Food</span>
                    <select
                      className="field mt-1"
                      value={row.relationToFood ?? ""}
                      onChange={(e) =>
                        update(row.key, { relationToFood: (e.target.value || null) as Row["relationToFood"] })
                      }
                    >
                      <option value="">No instruction</option>
                      <option value="before">Before food</option>
                      <option value="after">After food</option>
                      <option value="with">With food</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">For how many days</span>
                    <input
                      className="field mt-1"
                      type="number"
                      min={1}
                      max={90}
                      placeholder="Ongoing"
                      value={row.durationDays ?? ""}
                      onChange={(e) =>
                        update(row.key, { durationDays: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#0d6b5f]"
                      checked={row.prn}
                      onChange={(e) => update(row.key, { prn: e.target.checked, times: e.target.checked ? [] : row.times })}
                    />
                    <span className="text-sm text-ink">Only when needed (SOS)</span>
                  </label>
                </div>

                {!row.prn && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted">Times</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {BASE_TIMES.map((b) => {
                        const actual = row.times.find((t) => hourOf(t) >= b.from && hourOf(t) < b.to);
                        const active = Boolean(actual);
                        return (
                          <button
                            key={b.time}
                            onClick={() => toggleTime(row, active ? actual! : b.time)}
                            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                              active
                                ? "border-brand-500 bg-brand-50 text-brand-700"
                                : "border-line bg-white text-muted hover:bg-paper"
                            }`}
                            aria-pressed={active}
                          >
                            {b.label} · {timeLabel(actual ?? b.time)}
                          </button>
                        );
                      })}
                      {row.times
                        .filter((t) => !BASE_TIMES.some((b) => hourOf(t) >= b.from && hourOf(t) < b.to))
                        .map((t) => (
                          <button
                            key={t}
                            onClick={() => toggleTime(row, t)}
                            className="rounded-full border border-brand-500 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700"
                            title="Remove this time"
                          >
                            {timeLabel(t)} ×
                          </button>
                        ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted">
                      Read from: <span className="font-mono">{row.rawSig}</span>
                    </p>
                  </div>
                )}

                {row.notes.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {row.notes.map((n) => (
                      <li key={n} className="text-xs text-warn">
                        • {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-warn">
            When you save, PokéMed checks this prescription against the medicines already on the list — duplicates and
            known risky pairs are flagged for a pharmacist. Decision support, not medical advice.
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-alert">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Confirm & save schedule"}
            </button>
            <Link href="/" className="btn-ghost">
              Cancel
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
