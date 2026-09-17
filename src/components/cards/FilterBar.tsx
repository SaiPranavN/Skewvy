'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export interface SortOption {
  label: string;
  /** null is the default ordering. */
  value: string | null;
}

/** Plain category names, or explicit label/value pairs where they differ. */
export type ChipOption = string | { label: string; value: string | null };

function normalise(option: ChipOption): { label: string; value: string | null } {
  return typeof option === 'string' ? { label: option, value: option } : option;
}

/**
 * The listing controls: category chips on the left, search and ordering on the
 * right.
 *
 * Every filter is a real link, so a filtered view is shareable and survives
 * JavaScript being unavailable. Only the search box needs client state, and it
 * falls back to a plain form submit.
 */
export function FilterBar({
  basePath,
  categories,
  activeCategory,
  categoryParam = 'category',
  allLabel = 'All',
  sorts,
  activeSort,
  searchPlaceholder,
  searchLabel,
  searchValue = '',
}: {
  basePath: string;
  categories: readonly ChipOption[];
  activeCategory: string | null;
  /** The query parameter the chips drive. */
  categoryParam?: string;
  allLabel?: string;
  sorts?: SortOption[];
  activeSort?: string | null;
  searchPlaceholder?: string;
  searchLabel?: string;
  searchValue?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefWith = (param: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {[{ label: allLabel, value: null }, ...categories.map(normalise)].map((option) => {
          const selected = option.value === activeCategory;
          return (
            <Link
              key={option.label}
              href={hrefWith(categoryParam, option.value)}
              aria-current={selected ? 'true' : undefined}
              className={`border px-3.5 py-2.5 text-[13px] font-semibold leading-none transition-colors duration-150 ${
                selected
                  ? 'border-primary bg-primary text-ground'
                  : 'border-[var(--border-default)] text-secondary hover:border-[var(--border-strong)] hover:text-primary'
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {searchPlaceholder && (
          <SearchBox
            basePath={basePath}
            initialValue={searchValue}
            placeholder={searchPlaceholder}
            label={searchLabel ?? 'Search'}
          />
        )}

        {sorts && sorts.length > 0 && (
          <nav aria-label="Sort" className="flex border border-[var(--border-default)]">
            {sorts.map((option) => {
              const selected = (option.value ?? null) === (activeSort ?? null);
              return (
                <Link
                  key={option.label}
                  href={hrefWith('sort', option.value)}
                  aria-current={selected ? 'true' : undefined}
                  className={`px-3.5 py-2.5 text-[13px] font-semibold leading-none transition-colors duration-150 ${
                    selected ? 'bg-primary text-ground' : 'text-secondary hover:text-primary'
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

function SearchBox({
  basePath,
  initialValue,
  placeholder,
  label,
}: {
  basePath: string;
  initialValue: string;
  placeholder: string;
  label: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const id = `search-${basePath.replace(/\W+/g, '-')}`;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = value.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  };

  return (
    <form onSubmit={submit} role="search" className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="field-dark min-h-[42px] w-[min(100%,260px)] py-2.5 pl-10 pr-3 text-[13px]"
      />
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tertiary"
    >
      <circle cx="7.75" cy="7.75" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M11.5 11.5L15.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
