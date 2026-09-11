'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminSearch({ basePath, initialValue }: { basePath: string; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        router.push(trimmed ? `${basePath}?q=${encodeURIComponent(trimmed)}` : basePath);
      }}
      className="flex gap-2"
    >
      <label htmlFor="admin-search" className="sr-only">
        Search content
      </label>
      <input
        id="admin-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by title"
        className="w-full max-w-xs rounded-[var(--radius-control)] border border-[var(--border-default)] bg-elevated px-4 py-2.5 text-sm text-primary placeholder:text-tertiary focus:border-[var(--border-strong)] focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:border-[var(--border-strong)]"
      >
        Search
      </button>
    </form>
  );
}
