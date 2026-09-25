'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArtifactCard } from './ArtifactCard';
import { EntityCard } from './EntityCard';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * A row of ordinary catalogue cards that scrolls sideways.
 *
 * The cards are the same ones the grids use, at the same size, so every image
 * is shown at the resolution it was sized for — nothing is blown up to fill a
 * hero. The row is a native scroller with snap points: a trackpad, a finger
 * or a scroll wheel all work without the buttons, and the buttons move a whole
 * view's worth of cards at a time.
 *
 * The dots underneath track which cards are in view and jump straight to one.
 */
export function CardCarousel({
  cards,
  label,
  priorityCount = 0,
}: {
  cards: ArtifactCardModel[];
  label: string;
  priorityCount?: number;
}) {
  const trackId = useId();
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [view, setView] = useState({ first: 0, last: 0, canPrev: false, canNext: cards.length > 1 });

  /** One card's width plus the gap after it: the distance between snap points. */
  const stride = useCallback(() => {
    const track = trackRef.current;
    const item = track?.querySelector<HTMLElement>('li');
    if (!track || !item) return 0;
    return item.offsetWidth + Number.parseFloat(getComputedStyle(track).columnGap || '0');
  }, []);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const step = stride();
    if (!track || step === 0) return;
    const first = Math.round(track.scrollLeft / step);
    const visible = Math.max(1, Math.floor((track.clientWidth + 8) / step));
    setView({
      first,
      last: Math.min(cards.length - 1, first + visible - 1),
      canPrev: track.scrollLeft > 4,
      canNext: track.scrollLeft + track.clientWidth < track.scrollWidth - 4,
    });
  }, [cards.length, stride]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [measure]);

  const behavior = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    const step = stride();
    if (!track || step === 0) return;
    const perView = Math.max(1, Math.floor((track.clientWidth + 8) / step));
    track.scrollBy({ left: direction * perView * step, behavior: behavior() });
  };

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * stride(), behavior: behavior() });
  };

  if (cards.length === 0) return null;

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="eyebrow m-0 text-[color:var(--color-indigo-soft)]">{label}</p>

        <div className="flex items-center gap-2.5">
          <p className="numeric m-0 text-[12px] font-bold text-tertiary" aria-live="polite">
            {view.first + 1}
            {view.last > view.first ? `–${view.last + 1}` : ''} of {cards.length}
          </p>
          <ArrowButton direction={-1} disabled={!view.canPrev} controls={trackId} onClick={() => page(-1)} />
          <ArrowButton direction={1} disabled={!view.canNext} controls={trackId} onClick={() => page(1)} />
        </div>
      </div>

      {/*
        * Padding on every side the cards' hard shadow and hover lift reach, so
        * the scroller's clipping edge never cuts them off.
        */}
      <ul
        id={trackId}
        ref={trackRef}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto overscroll-x-contain px-1 pb-3 pt-1"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            page(event.key === 'ArrowRight' ? 1 : -1);
          }
        }}
      >
        {cards.map((card, index) => (
          <li
            key={`${card.type}:${card.id}`}
            className="flex w-[min(290px,80vw)] flex-none snap-start pr-1.5"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${cards.length}`}
          >
            <div className="flex w-full [&>article]:w-full">
              {card.type === 'entity' ? (
                <EntityCard card={card} priority={index < priorityCount} />
              ) : (
                <ArtifactCard card={card} priority={index < priorityCount} />
              )}
            </div>
          </li>
        ))}
      </ul>

      {cards.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Jump to a card">
          {cards.map((card, index) => {
            const inView = index >= view.first && index <= view.last;
            return (
              <button
                key={`${card.type}:${card.id}`}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show card ${index + 1}: ${card.title}`}
                aria-current={index === view.first ? 'true' : undefined}
                className="group flex h-6 items-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-[5px] transition-all duration-200 ${
                    inView ? 'w-6 bg-[color:var(--color-paper)]' : 'w-3 bg-[var(--border-strong)] group-hover:bg-[var(--color-paper)]'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArrowButton({
  direction,
  disabled,
  controls,
  onClick,
}: {
  direction: 1 | -1;
  disabled: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-controls={controls}
      aria-label={direction === 1 ? 'Next cards' : 'Previous cards'}
      className="carousel-arrow"
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d={direction === 1 ? 'M3 9h11M9.5 4.5 14 9l-4.5 4.5' : 'M15 9H4M8.5 4.5 4 9l4.5 4.5'}
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="square"
        />
      </svg>
    </button>
  );
}
