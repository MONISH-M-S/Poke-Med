"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export default function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();

  if (pathname === "/elder" || pathname === "/login") return null;

  async function act(action: string) {
    setBusy(true);
    await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    window.location.href = "/";
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      {open && (
        <div className="mb-3 w-[290px] rounded-2xl border border-line bg-white p-4 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Demo controls</p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Not part of the product. Moves the clock so a missed dose can be shown in seconds.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button className="btn-primary w-full" disabled={busy} onClick={() => act("nextDose")}>
              Jump to the next dose
            </button>
            <button className="btn-ghost w-full" disabled={busy} onClick={() => act("nextMiss")}>
              Skip to next missed dose
            </button>
            <button className="btn-ghost w-full" disabled={busy} onClick={() => act("realTime")}>
              Use real time
            </button>
            <button className="btn-ghost w-full" disabled={busy} onClick={() => act("reset")}>
              Reset the 7-day demo
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="ml-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-bold text-white shadow-lg"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        Demo
      </button>
    </div>
  );
}
