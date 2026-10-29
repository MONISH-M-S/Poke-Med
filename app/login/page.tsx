"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot, Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/Theme";

const PEOPLE = {
  caregiver: {
    name: "Arjun",
    initial: "A",
    subtitle: "The family dashboard",
    detail: "Scan, schedule, report, and paired phones",
    demoPin: "2468",
  },
} as const;

// 1–9 then a centred 0, the way a phone keypad looks.
const PIN_KEYS: (string | null)[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", null];

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("next");
    // Only same-app paths: reject "//evil.com" and "/\evil.com", which browsers
    // treat as a different origin even though they start with a slash.
    const safe = target && target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/\\");
    setNext(safe ? target : null);
  }, []);

  async function signIn(value: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "caregiver", pin: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { role?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Could not sign in. Try again.");
        setPin("");
        return;
      }

      router.replace(next ?? "/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  function addDigit(d: string) {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
  }

  function clearPin() {
    setPin("");
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-paper">
      {/* Nav is hidden on this page, so the theme control lives here too. */}
      <div className="absolute right-5 top-5">
        <ThemeToggle compact />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Mascot width={168} className="mb-3" />
        </div>
        <h1 className="mb-8 flex justify-center">
          <Wordmark href={null} size={44} />
        </h1>

        <p className="text-center text-muted mb-8">Caregiver sign-in</p>

        <div className="card p-6">
          <p className="text-sm font-semibold text-ink mb-4">{PEOPLE.caregiver.name} (Caregiver)</p>
          <p className="text-xs text-muted mb-6">Demo PIN: {PEOPLE.caregiver.demoPin}</p>

          <div className="grid grid-cols-4 gap-3 mb-6" role="group" aria-label="PIN entry">
            {pin.split("").map((d, i) => (
              <div key={i} className="h-12 w-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold tabular-nums">
                {d}
              </div>
            ))}
            {Array.from({ length: 4 - pin.length }).map((_, i) => (
              <div key={i} className="h-12 w-12 rounded-xl border-2 border-line" />
            ))}
          </div>

          {error && <p className="text-sm text-alert mb-4 text-center">{error}</p>}

          <div className="grid grid-cols-3 gap-3 mb-3">
            {PIN_KEYS.map((k, index) =>
              k === null ? (
                <div key={`gap-${index}`} aria-hidden="true" />
              ) : (
                <button
                  key={k}
                  type="button"
                  onClick={() => addDigit(k)}
                  disabled={busy || pin.length >= 4}
                  className="h-12 rounded-xl border border-line bg-surface text-xl font-semibold text-ink hover:bg-brand-50 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {k}
                </button>
              ),
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={backspace}
              disabled={busy || pin.length === 0}
              className="flex-1 h-12 rounded-xl border border-line bg-surface text-xl font-semibold text-muted hover:bg-red-50 active:scale-[0.98] transition disabled:opacity-50"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto" aria-hidden="true">
                <path d="M9 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
                <path d="M15 10l-5 5 5 5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={clearPin}
              disabled={busy || pin.length === 0}
              className="flex-1 h-12 rounded-xl border border-line bg-surface text-xl font-semibold text-muted hover:bg-paper active:scale-[0.98] transition disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          {pin.length === 4 && !busy && (
            <button
              type="button"
              onClick={() => signIn(pin)}
              className="btn-primary w-full mt-4"
            >
              Sign in
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          The elder never enters a PIN. Use <strong>Set up phone</strong> on the dashboard to pair their device.
        </p>
      </div>
    </div>
  );
}