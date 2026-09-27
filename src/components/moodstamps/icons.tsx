/**
 * MoodStamps' own marks, drawn rather than typed so they sit on the pixel grid
 * at every size. All decorative: whatever they sit beside says the same thing
 * in words.
 */

/**
 * A postage stamp: perforated edges and an open window. The window is cut
 * out rather than filled, so it shows whatever the stamp sits on.
 */
export function StampMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M2 2h2a1 1 0 0 0 2 0h1a1 1 0 0 0 2 0h1a1 1 0 0 0 2 0h2v2a1 1 0 0 0 0 2v1a1 1 0 0 0 0 2v1a1 1 0 0 0 0 2v2h-2a1 1 0 0 0-2 0H9a1 1 0 0 0-2 0H6a1 1 0 0 0-2 0H2v-2a1 1 0 0 0 0-2V9a1 1 0 0 0 0-2V6a1 1 0 0 0 0-2V2ZM5 5v6h6V5H5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

/** Outward: something leaving you. */
export function SendIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M5 17L17 5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
      <path d="M8 5h9v9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

/** Inward: something arriving, into a tray. */
export function ReceiveIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M11 3v10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
      <path d="M6.5 8.5L11 13l4.5-4.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
      <path d="M3 13v6h16v-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l11 11M14.5 3.5l-11 11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" className="flex-none">
      <rect x="2" y="6" width="10" height="7" fill="currentColor" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="flex-none">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
    </svg>
  );
}
