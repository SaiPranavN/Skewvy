import Link from 'next/link';

export function SectionHeader({
  eyebrow,
  title,
  description,
  metricLabel,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** States exactly what a ranking is measuring, so no number is ambiguous. */
  metricLabel?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="label-caps mb-2 text-brand-bright">{eyebrow}</p>}
        <h2 className="text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-chalk sm:text-3xl">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-haze">{description}</p>}
        {metricLabel && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.6875rem] font-medium text-haze-dim">
            <span aria-hidden="true">📊</span>
            {metricLabel}
          </p>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className="shrink-0 rounded-full border border-white/14 px-4 py-2 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30 hover:text-chalk"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
