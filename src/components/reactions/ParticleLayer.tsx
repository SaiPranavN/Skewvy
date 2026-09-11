'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { ReactionType } from '@/lib/domain/types';

/**
 * Floating reaction particles.
 *
 * Restraint is the point: a reaction drifts upward with modest lateral travel,
 * slight rotation and a quiet fade. No trails, bursts, sparks or shake — the
 * animation is satisfying because it is smooth and immediate, not because it is
 * loud.
 *
 * Nodes are pooled and reused, and the visible count is capped, so sustained
 * rapid tapping never costs frame rate. Under `prefers-reduced-motion` the
 * travel is replaced by a short fade in place, handled in CSS.
 */

const MAX_PARTICLES = 24;
const BASE_LIFETIME_MS = 1600;

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
    const x = originX ?? width * (0.3 + Math.random() * 0.4);

    const element = pooled.element;
    element.textContent = reactionType === 'rotten_egg' ? '🥚' : '🏅';
    element.style.left = `${x}px`;
    element.style.animation = 'none';
    element.style.fontSize = `${15 + Math.random() * 7}px`;
    element.style.setProperty('--p-drift', `${(Math.random() - 0.5) * 44}px`);
    element.style.setProperty('--p-rise', `${-(120 + Math.random() * 70)}px`);
    element.style.setProperty('--p-spin', `${(Math.random() - 0.5) * 20}deg`);
    element.style.setProperty('--p-scale', `${0.9 + Math.random() * 0.25}`);
    element.style.opacity = '0';

    // Force a reflow so restarting the animation on a reused node restarts it.
    void element.offsetWidth;

    const duration = reduced ? 400 : BASE_LIFETIME_MS + Math.random() * 500;
    element.style.animation = reduced
      ? `reaction-fade ${duration}ms var(--ease-standard) forwards`
      : `reaction-float ${duration}ms var(--ease-standard) forwards`;

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
      className="pointer-events-none absolute inset-x-0 bottom-full h-48 overflow-visible"
    />
  );
}
