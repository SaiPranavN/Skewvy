/** Neutral placeholders matching the final layout. No colour, no gradient. */
export function CardSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[16/9] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3 w-2/5" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-3 w-3/5" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="skeleton h-[58px]" />
          <div className="skeleton h-[58px]" />
        </div>
        <div className="skeleton h-1 w-full" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Matches the ranked list rather than the card grid. */
export function RankedListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="border-t border-[var(--border-subtle)]" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="grid grid-cols-[1.75rem_3.5rem_minmax(0,1fr)_5rem] items-center gap-4 border-b border-[var(--border-subtle)] py-4"
        >
          <div className="skeleton h-3 w-5" />
          <div className="skeleton aspect-square w-14" />
          <div className="space-y-2">
            <div className="skeleton h-3.5 w-3/5" />
            <div className="skeleton h-3 w-2/5" />
          </div>
          <div className="skeleton h-5 w-full" />
        </li>
      ))}
    </ul>
  );
}
