import Link from 'next/link';

/** Short, factual, one clear next action. No illustration, no mark. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="panel px-6 py-12 text-center">
      <h3 className="text-base font-medium text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-secondary">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-block border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
