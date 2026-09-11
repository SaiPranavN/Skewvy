/**
 * The Skewvy wordmark — the brand's only mark. There is no icon, monogram or
 * badge version: it behaves like a publication masthead, never an app icon.
 *
 * The letters are set in the interface typeface so the mark stays consistent
 * with the product, and the "w" is replaced by a waveform drawn in brand red —
 * the one place red carries the identity rather than signalling state.
 */
export function Wordmark({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const scale = { sm: 15, md: 18, lg: 26 }[size];

  return (
    <span
      className={`inline-flex select-none items-baseline font-semibold tracking-[-0.02em] text-primary ${className}`}
      style={{ fontSize: scale, lineHeight: 1 }}
      role="img"
      aria-label="Skewvy"
    >
      <span aria-hidden="true">Ske</span>
      <Waveform scale={scale} />
      <span aria-hidden="true">vy</span>
    </span>
  );
}

/**
 * The "w", drawn as a signal trace. Its proportions are derived from the
 * surrounding type size so the mark stays optically balanced at any scale.
 */
function Waveform({ scale }: { scale: number }) {
  const width = scale * 0.92;
  const height = scale * 0.56;

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox="0 0 23 14"
      fill="none"
      className="mx-[0.02em] shrink-0 self-baseline"
      style={{ transform: `translateY(${scale * 0.015}px)` }}
    >
      <path
        d="M1 1.2 L5 12.8 L9 4.4 L11.5 9.6 L14 4.4 L18 12.8 L22 1.2"
        stroke="var(--color-brand)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
