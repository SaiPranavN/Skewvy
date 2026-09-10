'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { ReactionType } from '@/lib/domain/types';

/**
 * Floating reaction particles, in the style of a live-stream reaction stream.
 *
 * Implementation notes:
 *  - DOM nodes are pooled and reused; nothing is allocated per tap once warm.
 *  - A hard cap keeps rapid tapping from degrading frame rate.
 *  - Particles float upward with individual drift, rotation and scale, then fade.
 *  - Under `prefers-reduced-motion` the float is replaced by a brief pop-and-fade
 *    at the control, handled entirely in CSS.
 *  - Particles never travel far enough, or last long enough, to obscure the totals.
 */

const MAX_PARTICLES = 34;
const LIFETIME_MS = 2100;

export interface ParticleHandle {
  spawn: (reactionType: ReactionType, originX?: number) => void;
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

  const spawn = useCallback((reactionType: ReactionType, originX?: number) => {
    const container = containerRef.current;
    if (!container) return;
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
    const width = container.clientWidth || 200;
    const x = originX ?? width * (0.2 + Math.random() * 0.6);

    const element = pooled.element;
    element.textContent = reactionType === 'rotten_egg' ? '🥚' : '🏅';
    element.style.left = `${x}px`;
    element.style.animation = 'none';
    element.style.fontSize = `${18 + Math.random() * 16}px`;
    element.style.setProperty('--p-drift', `${(Math.random() - 0.5) * 110}px`);
    element.style.setProperty('--p-rise', `${-(150 + Math.random() * 130)}px`);
    element.style.setProperty('--p-spin', `${(Math.random() - 0.5) * 70}deg`);
    element.style.setProperty('--p-scale', `${0.82 + Math.random() * 0.5}`);
    element.style.opacity = '0';

    // Force a reflow so restarting the animation on a reused node actually restarts it.
    void element.offsetWidth;

    const duration = reduced ? 420 : LIFETIME_MS + Math.random() * 400;
    element.style.animation = reduced
      ? `pop-fade ${duration}ms ease forwards`
      : `float-up ${duration}ms cubic-bezier(0.25,0.6,0.35,1) forwards`;

    activeRef.current += 1;
    pooled.freeAt = now + duration;
    setTimeout(() => {
      activeRef.current = Math.max(0, activeRef.current - 1);
      element.style.opacity = '0';
    }, duration);
  }, []);

  useImperativeHandle(handleRef, () => ({ spawn }), [spawn]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-full h-64 overflow-visible"
    />
  );
}
