import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-brand-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="#0d6b5f" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="#0d6b5f" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Page not found</h1>
        <p className="text-muted mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}