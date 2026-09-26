'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * A small ⓘ that explains a number without printing the explanation on every
 * card.
 *
 * It opens on click or tap, and when reached by keyboard; Escape, clicking
 * elsewhere or moving focus away closes it. Hover alone never does anything,
 * so it works the same on a phone as with a mouse. The text sits in the page,
 * linked to the button, so a screen reader announces it when the button is
 * focused whether or not the bubble is showing.
 *
 * Inside a card whose title link covers the whole card, the `card-action`
 * class lifts the button above that link so tapping ⓘ does not open the page.
 */
export function InfoTip({
  text,
  label = 'What these numbers mean',
  align = 'end',
  tone = 'ground',
}: {
  text: string;
  label?: string;
  /** Which edge of the button the bubble lines up with. */
  align?: 'start' | 'end';
  tone?: 'ground' | 'paper';
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="card-action relative inline-flex align-middle"
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={id}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onFocus={(event) => {
          // Keyboard arrival opens it; a mouse or tap arrives by click instead.
          if (event.currentTarget.matches(':focus-visible')) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="info-tip-button"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="8" cy="4.6" r="1.05" fill="currentColor" />
        </svg>
      </button>

      <span
        id={id}
        role="note"
        className={`info-tip-bubble ${open ? '' : 'sr-only'} ${align === 'end' ? 'right-0' : 'left-0'} ${
          tone === 'paper' ? 'info-tip-on-paper' : ''
        }`}
      >
        {text}
      </span>
    </span>
  );
}

export const METRICS_EXPLAINER = 'Opinions count people. Reactions count taps, and one person can tap multiple times.';
