'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function EntitySearchField({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set('q', value.trim());
    else params.delete('q');
    const query = params.toString();
    router.push(query ? `/entities?${query}` : '/entities');
  };

  return (
    <form onSubmit={submit} role="search" className="flex gap-2">
      <label htmlFor="entity-search" className="sr-only">
        Search Entities
      </label>
      <input
        id="entity-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search Entities by name"
        className="w-full max-w-md rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-base text-chalk placeholder:text-haze-dim focus:border-white/30 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-xl border border-white/14 px-5 py-3 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30 hover:text-chalk"
      >
        Search
      </button>
    </form>
  );
}
