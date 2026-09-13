'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArtifactCard } from '@/components/cards/ArtifactCard';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The showcase carousel below the hero.
 *
 * One card holds the centre at full strength while its neighbours peek in,
 * scaled down and dimmed, so the row reads as a deck rather than a grid. It
 * advances on its own, on the control bar beneath it, on arrow keys, and on a
 * swipe.
 *
 * Autoplay stops the moment someone takes over — a pointer entering, a focus
 * landing inside, a swipe, or the tab going to the background — and it never
 * starts at all under `prefers-reduced-motion`. The cards stay fully
 * interactive throughout; the centre one is the only one reachable by tab, so
 * the off-screen neighbours cannot swallow focus.
 */

const AUTOPLAY_MS = 5200;

export function ShowcaseCarousel({ cards }: { cards: ArtifactCardModel[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const headingId = useId();

  const count = cards.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const previous = useCallback(() => go(index - 1), [go, index]);

  // Autoplay, suspended whenever a person is engaged with the deck.
  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => setIndex((current) => (current + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPaused(true);
      next();
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPaused(true);
      previous();
    }
  };

  /* --------------------------------- swipe -------------------------------- */

  /*
   * Attached natively rather than through React's synthetic layer.
   *
   * A reaction control inside a card calls `setPointerCapture` on press, which
   * retargets the matching `pointerup` — so a React handler on the track can
   * miss the end of a gesture that began on a counter. Listening on the element
   * itself, in the capture phase, sees both ends of every gesture regardless.
   */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onDown = (event: PointerEvent) => {
      // Touch and pen only: a mouse drag here would fight text selection.
      if (event.pointerType === 'mouse') return;
      pointerStart.current = { x: event.clientX, y: event.clientY };
    };

    const onUp = (event: PointerEvent) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start) return;

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;

      // Horizontal intent only, and far enough to be deliberate — otherwise
      // this is a tap on a reaction control and must be left alone.
      if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;

      setPaused(true);
      setIndex((current) => (((current + (deltaX < 0 ? 1 : -1)) % count) + count) % count);
    };

    const onCancel = () => {
      pointerStart.current = null;
    };

    track.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    track.addEventListener('pointerup', onUp, { capture: true, passive: true });
    track.addEventListener('pointercancel', onCancel, { capture: true, passive: true });

    return () => {
      track.removeEventListener('pointerdown', onDown, { capture: true });
      track.removeEventListener('pointerup', onUp, { capture: true });
      track.removeEventListener('pointercancel', onCancel, { capture: true });
    };
  }, [count]);

  if (count === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      aria-roledescription="carousel"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onKeyDown={onKeyDown}
    >
      <h2 id={headingId} className="sr-only">
        React to what people are talking about
      </h2>

      <div
        ref={trackRef}
        /*
         * `overflow-x-clip`: every card in the deck is positioned, including the
         * ones parked far off to the side at zero opacity, and without this they
         * push the document's scroll width past the viewport and give the whole
         * page a horizontal scrollbar.
         */
        className="relative mx-auto flex h-[540px] w-full max-w-[1440px] items-center justify-center overflow-x-clip sm:h-[560px]"
        style={{ touchAction: 'pan-y' }}
      >
        {cards.map((card, position) => {
          // Signed distance from centre, wrapped so the deck is a loop.
          let offset = position - index;
          if (offset > count / 2) offset -= count;
          if (offset < -count / 2) offset += count;

          const isCentre = offset === 0;
          const visible = Math.abs(offset) <= 2;

          return (
            <div
              key={`${card.type}:${card.id}`}
              data-centre={isCentre}
              aria-hidden={!isCentre}
              /*
               * `inert` is applied as a DOM property rather than a JSX prop:
               * React serialises the boolean attribute to an empty string on the
               * server and then warns about it on hydration. Setting it here
               * keeps only the centre card in the tab order, quietly.
               */
              ref={(node) => {
                if (node) node.inert = !isCentre;
              }}
              className="absolute w-[min(88vw,420px)] transition-[transform,opacity] duration-[420ms] ease-[var(--ease-enter)] sm:w-[420px]"
              style={{
                transform: `translateX(${offset * 74}%) scale(${isCentre ? 1 : 0.86})`,
                opacity: visible ? (isCentre ? 1 : 0.4) : 0,
                zIndex: 10 - Math.abs(offset),
                pointerEvents: isCentre ? 'auto' : 'none',
              }}
            >
              <ArtifactCard card={card} priority={position === 0} />
            </div>
          );
        })}
      </div>

      {/*
        * One control bar, set well clear of the deck so it reads as chrome
        * belonging to the carousel rather than as marks printed on the card
        * above it.
        */}
      {count > 1 && (
        <div className="mt-10 flex justify-center sm:mt-12">
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-surface p-1.5">
            <button
              type="button"
              onClick={() => {
                setPaused(true);
                previous();
              }}
              aria-label="Previous item"
              className="grid h-9 w-9 place-items-center rounded-full text-secondary transition-colors duration-150 hover:bg-surface-2 hover:text-primary"
            >
              <Chevron direction="left" />
            </button>

            <div className="flex items-center px-1.5" role="tablist" aria-label="Choose an item">
              {cards.map((card, position) => (
                <button
                  key={`${card.type}:${card.id}`}
                  role="tab"
                  type="button"
                  aria-selected={position === index}
                  aria-label={card.title}
                  onClick={() => {
                    setPaused(true);
                    go(position);
                  }}
                  className="group grid h-9 w-5 place-items-center"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-[3px] rounded-full transition-all duration-[220ms] ease-[var(--ease-standard)] ${
                      position === index
                        ? 'w-6 bg-primary'
                        : 'w-2.5 bg-[var(--border-strong)] group-hover:bg-secondary'
                    }`}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setPaused(true);
                next();
              }}
              aria-label="Next item"
              className="grid h-9 w-9 place-items-center rounded-full text-secondary transition-colors duration-150 hover:bg-surface-2 hover:text-primary"
            >
              <Chevron direction="right" />
            </button>
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        Item {index + 1} of {count}: {cards[index]?.title}
      </p>
    </section>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
