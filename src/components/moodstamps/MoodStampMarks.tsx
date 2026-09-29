/**
 * The Rotten Egg and the Medal as they appear on a stamp: drawn marks on a
 * paper tile, not emoji, so they look the same on every device and in the
 * downloaded image (which draws the same shapes on a canvas).
 */

export const EGG_SHELL = '#D3C886';

export function EggMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path
        d="M50 10C31 10 20 44 20 62c0 18 13 28 30 28s30-10 30-28c0-18-11-52-30-52Z"
        fill={EGG_SHELL}
        stroke="var(--color-ink)"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="58" cy="50" r="3.6" fill="var(--color-ink)" />
      <circle cx="44" cy="70" r="3.1" fill="var(--color-ink)" />
      <circle cx="60" cy="73" r="2.4" fill="var(--color-ink)" />
    </svg>
  );
}

export function MedalMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path d="M31 6h14l13 38-12 4Z" fill="var(--color-ink)" />
      <path d="M69 6H55L43 42l12 4Z" fill="var(--color-medal)" stroke="var(--color-ink)" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="50" cy="66" r="23" fill="var(--color-medal)" stroke="var(--color-ink)" strokeWidth="5" />
      <circle cx="50" cy="66" r="14.5" fill="none" stroke="var(--color-ink)" strokeWidth="3.2" />
      <path
        d="m50 56.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L50 71.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9Z"
        fill="var(--color-ink)"
      />
    </svg>
  );
}
