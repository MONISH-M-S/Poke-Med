"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/Theme";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/upload", label: "New prescription" },
  { href: "/report", label: "Report" },
];

type Me = { role: string; name: string } | null;

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/elder" || pathname.startsWith("/share/report")) return;
    let alive = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data?.role) setMe({ role: data.role, name: data.name });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (pathname === "/login" || pathname === "/elder" || pathname.startsWith("/share/report")) return null;

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login?switch=1");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface print:hidden">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Wordmark href="/" tagline={false} size={30} />

        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Main">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  // The underline carries the active state, not the colour alone.
                  active
                    ? "bg-brand-50 text-brand-700 underline decoration-2 underline-offset-4"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />

          <ThemeToggle compact />

          <span className="hidden items-center gap-2 rounded-lg px-2 py-1.5 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[11px] font-bold text-surface">
              {(me?.name ?? "A").slice(0, 1)}
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-semibold text-ink">{me?.name ?? "Arjun"}</span>
              <span className="block text-[10px] uppercase tracking-wide text-muted">
                {me?.role === "caregiver" ? "Caregiver" : "Signed in"}
              </span>
            </span>
          </span>

          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-paper hover:text-ink disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </nav>
      </div>
    </header>
  );
}
