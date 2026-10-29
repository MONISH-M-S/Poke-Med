import Link from "next/link";
import { Mascot } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <Mascot width={168} />
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