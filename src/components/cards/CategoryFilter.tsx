'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/** Horizontal filter rail. Each option is a real link, so filters are shareable. */
export function CategoryFilter({ categories, active }: { categories: string[]; active: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (category: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category) params.set('category', category);
    else params.delete('category');
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const options: Array<{ label: string; value: string | null }> = [
    { label: 'All', value: null },
    ...categories.map((category) => ({ label: category, value: category })),
  ];

  return (
    <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {options.map((option) => {
        const selected = option.value === active;
        return (
          <Link
            key={option.label}
            href={hrefFor(option.value)}
            aria-current={selected ? 'true' : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              selected
                ? 'border-white/30 bg-white/12 text-chalk'
                : 'border-white/10 text-haze hover:border-white/22 hover:text-chalk'
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
