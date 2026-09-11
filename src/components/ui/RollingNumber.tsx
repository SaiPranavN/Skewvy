'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCount } from '@/lib/domain/format';

/**
 * A reaction total.
 *
 * Own taps land immediately — the number is the feedback, so it must never lag
 * the press. A large remote jump rolls briefly so movement is legible, and any
 * change gets a short brightness emphasis that settles within 300ms. Nothing
 * bounces or rescales.
 */
export function RollingNumber({
  value,
  className = '',
  soft = false,
}: {
  value: number;
  className?: string;
  /** Remote crowd movement: rolls rather than snapping. */
  soft?: boolean;
}) {
  const [displayed, setDisplayed] = useState(value);
  const [emphasised, setEmphasised] = useState(false);
  const frameRef = useRef<number | null>(null);
  const previousRef = useRef(value);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = value;
    if (previous === value) return;

    const difference = Math.abs(value - previous);
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setEmphasised(true);
    const settle = setTimeout(() => setEmphasised(false), 300);

    if (reduced || (!soft && difference < 80)) {
      setDisplayed(value);
      return () => clearTimeout(settle);
    }

    const start = performance.now();
    const from = previous;
    const duration = Math.min(600, 200 + difference * 1.1);

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // Matches --ease-standard closely enough for a numeric roll.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (value - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      clearTimeout(settle);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, soft]);

  return (
    <span className={`numeric-lg inline-block ${emphasised ? 'total-changed' : ''} ${className}`}>
      {formatCount(displayed)}
    </span>
  );
}
