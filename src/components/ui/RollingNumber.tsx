'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCount } from '@/lib/domain/format';

/**
 * A large total that animates gently when it changes.
 *
 * Own taps get an immediate bump; remote crowd movement rolls in more softly so
 * the two are distinguishable. Announcements are throttled so a rapid burst does
 * not flood a screen reader — see `ReactionZone` for the live region itself.
 */
export function RollingNumber({
  value,
  className = '',
  soft = false,
}: {
  value: number;
  className?: string;
  soft?: boolean;
}) {
  const [displayed, setDisplayed] = useState(value);
  const [bumping, setBumping] = useState(false);
  const frameRef = useRef<number | null>(null);
  const previousRef = useRef(value);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = value;
    if (previous === value) return;

    const difference = Math.abs(value - previous);
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Small or personal changes snap; large remote jumps roll to show movement.
    if (reduced || (!soft && difference < 60)) {
      setDisplayed(value);
      setBumping(true);
      const timer = setTimeout(() => setBumping(false), 240);
      return () => clearTimeout(timer);
    }

    const start = performance.now();
    const from = previous;
    const duration = Math.min(900, 260 + difference * 1.6);

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (value - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, soft]);

  return (
    <span className={`tabular inline-block ${bumping ? 'count-bump' : ''} ${className}`}>
      {formatCount(displayed)}
    </span>
  );
}
