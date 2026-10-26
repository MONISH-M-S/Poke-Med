"use client";

import { cn } from "@/lib/cn";

/** Base shimmer animation — respects prefers-reduced-motion */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-line rounded", className)}
      {...props}
    />
  );
}

/** Dashboard skeleton — mirrors the real layout structure */
export function DashboardSkeleton() {
  return (
    <div className="container-app py-8 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Alerts skeleton */}
      <Skeleton className="h-20 rounded-2xl" />

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Today section */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-3">
            {["Morning", "Afternoon", "Night"].map((b) => (
              <div key={b} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="w-[74px] h-5" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar cards */}
        <div className="space-y-5">
          {/* Adherence */}
          <div className="card p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-end gap-3">
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-4 w-56" />
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-12 rounded-md mx-auto w-full" />
                  <Skeleton className="h-3 w-12 mx-auto mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="card p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border border-line p-2.5">
                  <Skeleton className="mt-1.5 h-2 w-2 rounded-full shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-64" />
          </div>

          {/* Medicines */}
          <div className="card p-5 sm:p-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            <ul className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Elder screen skeleton */
export function ElderSkeleton() {
  return (
    <div className="elder-body min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-8 pt-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
        <div className="mt-6 flex items-baseline justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-28 tabular-nums" />
        </div>
        <div className="mt-5 rounded-2xl bg-brand-50 p-4 text-center">
          <Skeleton className="h-8 w-64 mx-auto" />
        </div>
        <div className="mt-8">
          <button className="elder-taken w-full" disabled>
            <Skeleton className="h-10 w-48 mx-auto" />
          </button>
        </div>
        <div className="mt-6 text-center">
          <Skeleton className="h-4 w-48 mx-auto" />
          <Skeleton className="h-4 w-60 mx-auto mt-1" />
        </div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full bg-brand-100" />
          <Skeleton className="h-12 w-12 rounded-full bg-brand-100" />
          <Skeleton className="h-12 w-12 rounded-full bg-brand-100" />
        </div>
      </div>
    </div>
  );
}

/** Report skeleton */
export function ReportSkeleton() {
  return (
    <div className="container-app py-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="mt-3 flex items-end gap-3">
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-56" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-12 rounded-md mx-auto w-full" />
              <Skeleton className="h-3 w-12 mx-auto mt-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5 sm:p-6 space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <Skeleton className="h-8 w-8 rounded-full bg-brand-100" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Upload/Review skeleton */
export function UploadSkeleton() {
  return (
    <div className="container-app py-8 space-y-6 max-w-3xl">
      <div>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="card p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="aspect-video rounded-xl bg-line" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}

/** Schedule skeleton */
export function ScheduleSkeleton() {
  return (
    <div className="container-app py-8 space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="card p-5 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
            <Skeleton className="h-3 w-40 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic card row skeleton for lists */
export function CardRowSkeleton({ count = 3 }: { count?: number } = {}) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 bg-white px-4 py-3">
          <Skeleton className="w-[74px] h-5 shrink-0" />
          <div className="flex-1 space-y-1 min-w-0">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0" />
          <Skeleton className="h-6 w-24 shrink-0" />
        </li>
      ))}
    </ul>
  );
}