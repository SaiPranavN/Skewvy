import Link from 'next/link';

/**
 * A section heading. The metric line matters: every ranked surface must say
 * what it counted, so no number on the page is ambiguous.
 */
export function SectionHeader({
  title,
  description,
  metricLabel,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  metricLabel?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={`mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${className}`}>
      <div className="max-w-2xl">
        <h2 className="text-lg font-medium tracking-[-0.01em] text-primary sm:text-xl">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-secondary">{description}</p>}
        {metricLabel && <p className="mt-1.5 text-xs text-tertiary">{metricLabel}</p>}
      </div>

      {action && (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm text-secondary transition-colors duration-150 hover:text-primary"
        >
          {action.label}
          <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      )}
    </div>
  );
}
