import Link from "next/link";
import { ClockIcon } from "@/components/icons";

export default function InvalidPairingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-warn">
          <ClockIcon size={32} strokeWidth={1.8} />
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