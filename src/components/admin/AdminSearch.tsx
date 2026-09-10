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
        className="w-full max-w-xs rounded-xl border border-white/12 bg-black/35 px-4 py-2.5 text-sm text-chalk placeholder:text-haze-dim focus:border-white/30 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl border border-white/14 px-4 py-2.5 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
      >
        Search
      </button>
    </form>
  );
}
