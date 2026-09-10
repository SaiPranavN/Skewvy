'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SearchField({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  };

  return (
    <form onSubmit={submit} role="search" className="flex max-w-2xl gap-2">
      <label htmlFor="site-search" className="sr-only">
        Search Skewvy
      </label>
      <input
        id="site-search"
        type="search"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search Entities and Flash News"
        className="w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3.5 text-base text-chalk placeholder:text-haze-dim focus:border-white/30 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
      >
        Search
      </button>
    </form>
  );
}
