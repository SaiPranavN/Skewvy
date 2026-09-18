/**
 * The egg and the medal, drawn rather than typed.
 *
 * The emoji cannot be relied on here: 🥚 renders as a near-white shape on
 * every major platform, which disappears entirely on a cream panel, and both
 * glyphs look different on Windows, Android and macOS. These marks take their
 * colour from `--mark-egg` / `--mark-medal`, which flip to darker values
 * inside a paper context, so they stay legible on the ground and on cream.
 *
 * They are decorative in every current usage — the label beside them already
 * says "eggs" or "medals" — so they are hidden from assistive technology.
 */

function markStyle(mark: 'egg' | 'medal'): React.CSSProperties {
  return { color: mark === 'egg' ? 'var(--mark-egg)' : 'var(--mark-medal)' };
}

export function EggIcon({ size = 14, className = '' }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 align-[-0.12em] ${className}`}
      style={markStyle('egg')}
    >
      <path
        d="M12 2.4c3.4 0 6.4 5 6.4 9.6a6.4 6.4 0 0 1-12.8 0c0-4.6 3-9.6 6.4-9.6Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MedalIcon({ size = 14, className = '' }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 align-[-0.12em] ${className}`}
      style={markStyle('medal')}
    >
      {/*
        * Solid ribbon bands rather than thin strokes: at 14px two hairlines
        * rising off a disc read as antennae, not as a medal.
        */}
      <path d="M6.2 1.8h3.9l3.2 7.1H9.4Z" fill="currentColor" />
      <path d="M17.8 1.8h-3.9l-3.2 7.1h3.9Z" fill="currentColor" />
      <circle cx="12" cy="15.6" r="6.4" fill="currentColor" />
    </svg>
  );
}

/** Picks the mark for a reaction type, at a shared size. */
export function ReactionMark({
  reactionType,
  size = 14,
  className = '',
}: {
  reactionType: 'rotten_egg' | 'medal';
  size?: number | string;
  className?: string;
}) {
  return reactionType === 'rotten_egg' ? (
    <EggIcon size={size} className={className} />
  ) : (
    <MedalIcon size={size} className={className} />
  );
}
