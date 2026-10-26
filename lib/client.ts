"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, DoseView } from "./types";

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

/** Optimistically update a dose to "taken" or "snooze" and return the previous state for rollback. */
export function optimisticUpdate(
  setState: React.Dispatch<React.SetStateAction<AppState | null>>,
  doseId: string,
  action: "taken" | "snooze"
): AppState | null {
  let previous: AppState | null = null;
  setState((current) => {
    if (!current) return current;
    previous = current;
    const doseIndex = current.today.findIndex((d) => d.id === doseId);
    if (doseIndex === -1) return current;

    const newToday = [...current.today];
    const dose = newToday[doseIndex];

    if (action === "taken") {
      newToday[doseIndex] = {
        ...dose,
        status: "taken",
        actedAt: new Date().toISOString(),
        actedBy: "caregiver",
      };
      // Update week stats
      const dateKey = dose.dateKey;
      const dayIndex = current.week.days.findIndex((d) => d.date === dateKey);
      if (dayIndex !== -1) {
        const newDays = [...current.week.days];
        newDays[dayIndex] = {
          ...newDays[dayIndex],
          taken: newDays[dayIndex].taken + 1,
          missed: Math.max(0, newDays[dayIndex].missed - 1),
        };
        return {
          ...current,
          today: newToday,
          week: {
            ...current.week,
            taken: current.week.taken + 1,
            missed: Math.max(0, current.week.missed - 1),
            total: current.week.total,
            days: newDays,
            percent: current.week.total === 0 ? 100 : Math.round(((current.week.taken + 1) / current.week.total) * 100),
          },
          alerts: current.alerts.filter((a) => a.doseId !== doseId),
        };
      }
    } else if (action === "snooze") {
      const next = new Date(Date.now() + 10 * 60_000);
      newToday[doseIndex] = {
        ...dose,
        scheduledAt: next.toISOString(),
        status: "due",
      };
      return {
        ...current,
        today: newToday,
        alerts: current.alerts.filter((a) => a.doseId !== doseId),
      };
    }
    return current;
  });
  return previous;
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
