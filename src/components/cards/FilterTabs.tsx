'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export interface FilterOption {
  label: string;
  /** null clears the filter. */
  value: string | null;
}

/**
 * Filters as text with a thin active rule — no filled pills. Each option is a
 * real link, so a filtered view is shareable and works without JavaScript.
 */
export function FilterTabs({
  options,
  active,
  param = 'category',
  label,
}: {
  options: FilterOption[];
  active: string | null;
  param?: string;
  label: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <nav aria-label={label} className="no-scrollbar -mx-4 overflow-x-auto border-b border-[var(--border-subtle)] px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-5">
        {options.map((option) => {
          const selected = option.value === active;
          return (
            <li key={option.label}>
              <Link
                href={hrefFor(option.value)}
                aria-current={selected ? 'true' : undefined}
                className={`relative -mb-px block py-2.5 text-sm transition-colors duration-150 ${
                  selected ? 'text-primary' : 'text-tertiary hover:text-secondary'
                }`}
              >
                {option.label}
                {selected && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-brand" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
