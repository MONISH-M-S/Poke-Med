import Link from "next/link";

/**
 * PokéMed wordmark: a two-tone "dose dial" mark (teal = taken, orange =
 * still due) with a check, plus the name set as real text so it stays
 * crisp and inherits the theme's ink colour.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role="img"
      aria-label="PokéMed"
    >
      {/* Teal wedge: the "taken" half. A small gap separates it from orange. */}
      <path
        d="M80.18 15.28 A46 46 0 0 0 15.28 80.18 Z"
        fill="rgb(var(--c-logo-teal))"
      />
      {/* Orange wedge: the "still due" half. */}
      <path
        d="M84.72 19.82 A46 46 0 0 1 19.82 84.72 Z"
        fill="rgb(var(--c-logo-orange))"
      />
      {/* Check disc */}
      <circle cx="42" cy="52" r="20" fill="rgb(var(--c-surface))" stroke="rgb(var(--c-logo-navy))" strokeWidth="4.5" />
      <path
        d="M33 52.5 L39.5 59 L52 45"
        stroke="rgb(var(--c-logo-teal))"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  tagline = true,
  size = 34,
}: {
  href?: string | null;
  tagline?: boolean;
  size?: number;
}) {
  const body = (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} className="shrink-0" />
      <span className="leading-none">
        <span
          className="block font-extrabold tracking-tight"
          style={{ fontSize: size * 0.62, lineHeight: 1 }}
        >
          <span style={{ color: "rgb(var(--c-logo-navy))" }}>Poké</span>
          <span style={{ color: "rgb(var(--c-logo-teal))" }}>Med</span>
        </span>
        {tagline && (
          <span
            className="mt-1 block font-semibold uppercase tracking-[0.14em] text-muted"
            style={{ fontSize: Math.max(9, size * 0.235) }}
          >
            Every dose, understood.
          </span>
        )}
      </span>
    </span>
  );

  if (!href) return body;
  return (
    <Link href={href} aria-label="PokéMed home" className="shrink-0">
      {body}
    </Link>
  );
}

/**
 * The badger mascot. Artwork only — its paper background is cut to alpha, so
 * it sits on any theme. Used where there is room for it (sign-in, empty
 * states); the compact chrome uses `Wordmark` instead, since a raster mark
 * goes soft at small sizes.
 */
export function Mascot({ width = 200, className = "" }: { width?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mascot.png"
      alt="PokéMed mascot: a badger hugging a dose dial"
      width={width}
      height={Math.round((width * 226) / 267)}
      className={className}
      decoding="async"
    />
  );
}
