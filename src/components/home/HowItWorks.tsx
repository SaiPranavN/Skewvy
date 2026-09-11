/**
 * A compact editorial strip rather than three decorated step cards. It explains
 * the one thing that is genuinely non-obvious: reactions and opinions are
 * different measurements.
 */
const STEPS = [
  {
    title: 'Find a story or an entity',
    copy: 'Flash News covers a specific event. An Entity accumulates sentiment over time.',
  },
  {
    title: 'React as often as you like',
    copy: 'Each tap adds one Rotten Egg or one Medal to the public reaction total.',
  },
  {
    title: 'Count once in the opinion',
    copy: 'However many times you react, you count as one person on one side.',
  },
];

export function HowItWorks() {
  return (
    <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step.title} className="border-t border-[var(--border-subtle)] pt-4">
          <span className="numeric text-xs text-tertiary">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="mt-2 text-sm font-medium text-primary">{step.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-secondary">{step.copy}</p>
        </li>
      ))}
    </ol>
  );
}
