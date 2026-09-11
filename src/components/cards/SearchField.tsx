'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/** Shared search input. `basePath` decides which listing it drives. */
export function SearchField({
  basePath,
  initialValue,
  placeholder,
  label,
  autoFocus = false,
}: {
  basePath: string;
  initialValue: string;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
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
    <form onSubmit={submit} role="search" className="flex max-w-xl gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-elevated px-3.5 py-2.5 text-[0.9375rem] text-primary placeholder:text-disabled transition-colors duration-150 focus:border-[var(--border-strong)] focus:outline-none"
      />
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
      >
        Search
      </button>
    </form>
  );
}
