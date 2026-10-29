import type { Metadata } from "next";
import OpenSharedReport from "@/components/OpenSharedReport";
import { peekReportShare } from "@/lib/report-share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Shared medication report — PokéMed",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await peekReportShare(token);

  if (!valid) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center px-5 py-12">
        <div className="card w-full max-w-md p-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-warn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="label mt-5">PokéMed</p>
          <h1 className="h1 mt-1">This report link is not available</h1>
          <p className="muted mt-3">
            It may have expired, already been opened, or been copied incorrectly. Ask the caregiver to create a new
            one-time link.
          </p>
        </div>
      </div>
    );
  }

  return <OpenSharedReport token={token} />;
}
