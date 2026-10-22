"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Who = "elder" | "caregiver";

const PIN_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const PEOPLE = {
  elder: {
    name: "Lakshmi",
    initial: "L",
    subtitle: "Her own medicine screen",
    detail: "Today's doses and one big Taken button",
    demoPin: "1234",
  },
  caregiver: {
    name: "Arjun",
    initial: "A",
    subtitle: "The family dashboard",
    detail: "Scan, schedule, report, and her screen",
    demoPin: "2468",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);

  // Nobody is selected until a person is chosen. Opening the app must never
  // drop someone into the elder screen by accident.
  const [who, setWho] = useState<Who | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("next");
    setNext(target && target.startsWith("/") ? target : null);
  }, []);

  const person = who ? PEOPLE[who] : null;

  async function signIn(value: string, role: Who) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: role, pin: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { role?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Could not sign in. Try again.");
        setPin("");
        return;
      }

      router.replace(data.role === "elder" ? "/elder" : next ?? "/");
      router.refresh();
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function press(key: string) {
    if (busy || !who) return;
    setError("");

    if (key === "clear") {
      setPin("");
      return;
    }
    if (key === "back") {
      setPin((current) => current.slice(0, -1));
      return;
    }

    const value = (pin + key).slice(0, 4);
    setPin(value);
    if (value.length === 4) void signIn(value, who);
  }

  function choose(role: Who) {
    if (busy || role === who) return;
    setWho(role);
    setPin("");
    setError("");
  }

  return (
    <div className="container-app py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Two people, two doors
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Who is picking up the phone?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
            Each person has their own PIN. Lakshmi&apos;s opens only her medicine screen. Arjun&apos;s opens the
            family dashboard.
          </p>
        </div>

        {!who || !person ? (
          <div className="mt-8 flex flex-col gap-3">
            {(Object.keys(PEOPLE) as Who[]).map((role) => {
              const profile = PEOPLE[role];
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => choose(role)}
                  className="card flex w-full items-center gap-4 p-5 text-left transition hover:border-brand-100 hover:bg-brand-50 sm:p-6"
                >
                  <span
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white ${
                      role === "elder" ? "bg-brand-600" : "bg-ink"
                    }`}
                  >
                    {profile.initial}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-ink">{profile.name}</span>
                    <span className="block text-sm text-muted">{profile.subtitle}</span>
                    <span className="mt-0.5 block text-xs text-muted">{profile.detail}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-brand-700">Enter PIN →</span>
                </button>
              );
            })}

            <p className="mt-2 text-center text-xs leading-relaxed text-muted">
              No passwords. Four digits each, with a keypad big enough to use at arm&apos;s length.
            </p>
          </div>
        ) : (
          <section className="card mt-6 p-6 sm:p-8" aria-labelledby="pin-title">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setWho(null);
                  setPin("");
                  setError("");
                }}
                className="text-sm font-semibold text-muted underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                ← Not {person.name}?
              </button>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-lg text-[11px] font-bold text-white ${
                    who === "elder" ? "bg-brand-600" : "bg-ink"
                  }`}
                >
                  {person.initial}
                </span>
                {person.subtitle}
              </span>
            </div>

            <h2 id="pin-title" className="mt-4 text-center text-lg font-bold text-ink">
              {person.name}&apos;s 4-digit PIN
            </h2>

            <div className="mt-5 flex items-center justify-center gap-3.5" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-5 w-5 rounded-full transition ${
                    i < pin.length ? "scale-110 bg-brand-600" : "bg-line"
                  }`}
                />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              {pin.length} of 4 digits entered for {person.name}
            </p>

            <div className="mx-auto mt-6 grid w-full max-w-[340px] grid-cols-3 gap-3">
              {PIN_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => press(key)}
                  disabled={busy}
                  className="h-20 rounded-2xl border border-line bg-white text-3xl font-bold text-ink transition hover:bg-brand-50 disabled:opacity-50"
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                onClick={() => press("clear")}
                disabled={busy}
                className="h-20 rounded-2xl border border-line bg-paper text-sm font-semibold text-muted transition hover:bg-white disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => press("0")}
                disabled={busy}
                className="h-20 rounded-2xl border border-line bg-white text-3xl font-bold text-ink transition hover:bg-brand-50 disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => press("back")}
                disabled={busy}
                aria-label="Delete last digit"
                className="h-20 rounded-2xl border border-line bg-paper text-2xl font-semibold text-muted transition hover:bg-white disabled:opacity-50"
              >
                ⌫
              </button>
            </div>

            <div className="mt-5 min-h-[46px]" aria-live="polite">
              {busy ? (
                <p className="text-center text-sm font-semibold text-brand-700">Signing in…</p>
              ) : error ? (
                <p className="text-center text-sm font-semibold text-alert">{error}</p>
              ) : (
                <p className="text-center text-xs text-muted">
                  Demo PIN for {person.name} <strong className="text-ink">{person.demoPin}</strong>{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPin(person.demoPin);
                      void signIn(person.demoPin, who);
                    }}
                    className="ml-1 underline decoration-dotted underline-offset-2 hover:text-ink"
                  >
                    Use it
                  </button>
                </p>
              )}
            </div>
          </section>
        )}

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          Prototype sign-in: PINs are scrypt-hashed, and the session is a signed, http-only cookie. There is no
          password to remember, reset, or type on a small keyboard — but there is also no account recovery. Set{" "}
          <code className="rounded bg-paper px-1">AUTH_SECRET</code> before deploying anywhere real.
        </p>
      </div>
    </div>
  );
}
