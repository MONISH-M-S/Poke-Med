import Link from "next/link";

export default function InvalidPairingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-amber-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z"
              stroke="#a15c07"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path d="M10.5 19a2 2 0 0 0 3 0" stroke="#a15c07" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Pairing link expired</h1>
        <p className="text-muted mb-6">
          This pairing link has expired or was already used. Pairing links are valid for 5 minutes and can only be used
          once.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/login" className="btn-primary">
            Sign in as caregiver
          </Link>
          <Link href="/" className="btn-ghost">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}