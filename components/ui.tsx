import type { DoseStatus, FoodRel } from "@/lib/types";

export function StatusPill({ status }: { status: DoseStatus }) {
  if (status === "taken")
    return (
      <span className="pill bg-brand-50 text-brand-700">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Taken
      </span>
    );
  if (status === "missed")
    return (
      <span className="pill bg-red-50 text-alert">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8v5m0 3.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        </svg>
        Missed
      </span>
    );
  return <span className="pill bg-amber-50 text-warn">Due</span>;
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

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-paper px-4 py-5 text-sm text-muted">{children}</p>;
}
