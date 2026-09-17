'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Overlay } from '@/components/ui/Overlay';
import type { ReactionType } from '@/lib/domain/types';

/**
 * Flying reaction particles.
 *
 * A reaction is thrown up and out of the control that fired it, tumbling as it
 * goes, and is gone within a second. Loud on purpose: this is the one place in
 * the system where something moves a long way.
 *
 * Particles are positioned in viewport coordinates from the firing element's
 * rect, so they keep travelling past the edge of whatever panel spawned them —
 * a hero slab and the sticky tray behave identically. Nodes are pooled and the
 * visible count is capped, so sustained rapid tapping never costs frame rate.
 * Under `prefers-reduced-motion` the travel is replaced by a short fade in
 * place, handled in CSS.
 */

const MAX_PARTICLES = 14;
const LIFETIME_MS = 900;

export interface ParticleHandle {
  /** `origin` is the firing control's viewport rect. */
  spawn: (reactionType: ReactionType, origin?: DOMRect | null) => void;
}

interface PooledParticle {
  element: HTMLSpanElement;
  freeAt: number;
}

export function ParticleLayer({ handleRef }: { handleRef: Ref<ParticleHandle> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef<PooledParticle[]>([]);
  const activeRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = media.matches;
    const listener = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const spawn = useCallback((reactionType: ReactionType, origin?: DOMRect | null) => {
    const container = containerRef.current;
    if (!container || !origin) return;
    if (activeRef.current >= MAX_PARTICLES) return;

    const now = performance.now();
    let pooled = poolRef.current.find((candidate) => candidate.freeAt <= now);

    if (!pooled) {
      if (poolRef.current.length >= MAX_PARTICLES) return;
      const element = document.createElement('span');
      element.className = 'particle emoji';
      element.setAttribute('aria-hidden', 'true');
      container.appendChild(element);
      pooled = { element, freeAt: 0 };
      poolRef.current.push(pooled);
    }

    const reduced = reducedMotionRef.current;
    const element = pooled.element;

    element.textContent = reactionType === 'rotten_egg' ? '🥚' : '🏅';
    element.style.left = `${origin.left + origin.width * (0.2 + Math.random() * 0.6)}px`;
    element.style.top = `${origin.top - 6}px`;
    element.style.fontSize = `${24 + Math.random() * 18}px`;
    element.style.animation = 'none';
    element.style.setProperty('--p-drift', `${Math.round((Math.random() - 0.5) * 200)}px`);
    element.style.setProperty('--p-rise', `${-(200 + Math.random() * 60)}px`);
    element.style.setProperty('--p-spin', `${Math.round((Math.random() - 0.5) * 460)}deg`);
    element.style.opacity = '0';

    // Force a reflow so restarting the animation on a reused node restarts it.
    void element.offsetWidth;

    const duration = reduced ? 400 : LIFETIME_MS;
    element.style.animation = reduced
      ? `reaction-fade ${duration}ms var(--ease-standard) forwards`
      : `skv-fly ${duration}ms cubic-bezier(.22,.7,.3,1) forwards`;

    activeRef.current += 1;
    pooled.freeAt = now + duration;
    setTimeout(() => {
      activeRef.current = Math.max(0, activeRef.current - 1);
      element.style.opacity = '0';
    }, duration);
  }, []);

  useImperativeHandle(handleRef, () => ({ spawn }), [spawn]);

  return (
    <Overlay>
      <div ref={containerRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" />
    </Overlay>
  );
}
