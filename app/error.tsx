"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-red-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z"
              stroke="#b3261e"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path d="M10.5 19a2 2 0 0 0 3 0" stroke="#b3261e" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Something went wrong</h1>
        <p className="text-muted mb-6">
          We hit an unexpected error. Your data is safe — this is just a display problem.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="btn-primary"
          >
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Go home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[11px] text-muted font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}