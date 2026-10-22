"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/upload", label: "New prescription" },
  { href: "/report", label: "Report" },
  { href: "/elder", label: "Elder screen" },
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/elder") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur print:hidden">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8.5 15.5 15.5 8.5a3.5 3.5 0 1 1 5 5l-7 7a3.5 3.5 0 0 1-5-5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="m6 18 12-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".45" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-tight text-ink">PokéMed</span>
            <span className="block text-[11px] font-medium text-muted">Lakshmi&apos;s medicines</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Main">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
