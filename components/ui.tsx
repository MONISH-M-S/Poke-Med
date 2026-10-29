import type { DoseStatus, FoodRel } from "@/lib/types";
import { AlertIcon, CheckIcon, ClockIcon } from "@/components/icons";

/**
 * Every pill pairs a distinct shape with its word and its colour, so the
 * status survives greyscale printing and colour vision differences.
 */
export function StatusPill({ status }: { status: DoseStatus }) {
  if (status === "taken")
    return (
      <span className="pill bg-brand-50 text-brand-700">
        <CheckIcon />
        Taken
      </span>
    );
  if (status === "missed")
    return (
      <span className="pill bg-red-50 text-alert">
        <AlertIcon />
        Missed
      </span>
    );
  return (
    <span className="pill bg-amber-50 text-warn">
      <ClockIcon />
      Due
    </span>
  );
}

export function FoodNote({ rel }: { rel: FoodRel }) {
  if (!rel) return null;
  const text = rel === "after" ? "after food" : rel === "before" ? "before food" : "with food";
  return <span className="text-xs text-muted">· {text}</span>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="h2">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={`rounded-xl bg-paper px-4 py-5 text-sm text-muted ${className ?? ""}`}>{children}</p>;
}
