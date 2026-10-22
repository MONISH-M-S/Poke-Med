"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState } from "./types";

export function useAppState(pollMs = 5000) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load the dashboard.");
      const data = (await res.json()) as AppState;
      if (alive.current) {
        setState(data);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const id = setInterval(load, pollMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, pollMs]);

  return { state, setState, error, reload: load };
}

export async function postJSON<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export function clockNote(offsetMinutes: number): string | null {
  if (!offsetMinutes) return null;
  const sign = offsetMinutes > 0 ? "+" : "−";
  const abs = Math.abs(offsetMinutes);
  const d = Math.floor(abs / 1440);
  const h = Math.floor((abs % 1440) / 60);
  const m = Math.round(abs % 60);
  const parts = [d ? `${d}d` : "", h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
  return `Demo clock ${sign}${parts || "0m"}`;
}
