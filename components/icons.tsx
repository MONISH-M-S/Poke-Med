/**
 * Status glyphs. Colour never carries meaning on its own in PokéMed:
 * "taken" always shows a tick, "missed" always shows a "!", and
 * "due/waiting" always shows a clock — on top of the colour and the word.
 * These are aria-hidden because the adjacent text already says it.
 */

export function CheckIcon({ size = 12, strokeWidth = 2.4 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** "!" inside a circle — the missed/error mark. Distinct shape from the tick. */
export function AlertIcon({ size = 12, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth={strokeWidth + 0.4} strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.15" fill="currentColor" />
    </svg>
  );
}

/** Clock — used for "due now", so pending is not just a colour. */
export function ClockIcon({ size = 12, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="M12 7v5.2l3.3 2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Arrow — "upcoming", a later dose. Distinct from the due clock. */
export function ArrowIcon({ size = 12, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M5 12h13m0 0-5.5-5.5M18 12l-5.5 5.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
