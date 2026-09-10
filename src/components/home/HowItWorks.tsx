'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  {
    emoji: '🔎',
    title: 'Find an Entity or Flash News',
    copy: 'Spot the headline.',
  },
  {
    emoji: '🥚',
    title: 'Tap Rotten Eggs or Medals',
    copy: 'Pick a side.',
    alternate: '🏅',
  },
  {
    emoji: '📈',
    title: 'Watch the public mood move',
    copy: 'Make the counter sweat.',
  },
];

/** Three steps with a small looping emoji demonstration. */
export function HowItWorks() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1400);
    return () => clearInterval(timer);
  }, []);

  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {STEPS.map((step, index) => (
        <li
          key={step.title}
          className="glass card-lift relative overflow-hidden rounded-[var(--radius-card)] p-5"
        >
          <span className="label-caps text-haze-dim">Step {index + 1}</span>

          <span
            className="emoji mt-3 block text-4xl transition-transform duration-500"
            aria-hidden="true"
            style={{ transform: tick % 3 === index ? 'translateY(-4px) scale(1.12)' : 'none' }}
          >
            {step.alternate && tick % 2 === 1 ? step.alternate : step.emoji}
          </span>

          <h3 className="mt-3 text-base font-semibold text-chalk">{step.title}</h3>
          <p className="mt-1 text-sm text-haze">{step.copy}</p>
        </li>
      ))}
    </ol>
  );
}
