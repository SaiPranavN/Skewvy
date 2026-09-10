import Link from 'next/link';

export function EmptyState({
  emoji = '🥚',
  title,
  description,
  action,
}: {
  emoji?: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="glass rounded-[var(--radius-card)] px-6 py-14 text-center">
      <p className="emoji text-4xl" aria-hidden="true">
        {emoji}
      </p>
      <h3 className="mt-4 text-lg font-semibold text-chalk">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-haze">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-block rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
