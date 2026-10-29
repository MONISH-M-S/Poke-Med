"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertIcon } from "@/components/icons";

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
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-alert">
          <AlertIcon size={34} strokeWidth={1.8} />
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