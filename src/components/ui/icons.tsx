/**
 * The egg and the medal, as the real emoji.
 *
 * 🥚 is drawn near-white on every major platform, which vanishes on a cream
 * panel, so it carries a hairline ink outline (`.emoji-egg`, a pair of
 * drop-shadows) that reads as an edge on cream and disappears into the dark
 * ground. The medal needs no help anywhere.
 *
 * They are decorative in every current usage — the label beside them already
 * says "eggs" or "medals" — so they are hidden from assistive technology.
 */

function Emoji({
  glyph,
  kind,
  size,
  className,
}: {
  glyph: string;
  kind: 'egg' | 'medal';
  size: number | string;
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`emoji emoji-${kind} inline-block shrink-0 align-[-0.1em] leading-none ${className}`}
      style={{ fontSize: typeof size === 'number' ? `${size}px` : size }}
    >
      {glyph}
    </span>
  );
}

export function EggIcon({ size = 14, className = '' }: { size?: number | string; className?: string }) {
  return <Emoji glyph="🥚" kind="egg" size={size} className={className} />;
}

export function MedalIcon({ size = 14, className = '' }: { size?: number | string; className?: string }) {
  return <Emoji glyph="🏅" kind="medal" size={size} className={className} />;
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
