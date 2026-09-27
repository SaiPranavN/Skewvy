/**
 * A MoodStamp card's shape before its data arrives: the same 7:5 stamp and the
 * same paper footer, so nothing jumps when the real cards land.
 */
export function MoodStampCardSkeleton() {
  return (
    <div className="border-2 border-[var(--border-default)]" aria-hidden="true">
      <div className="skeleton aspect-[7/5] w-full" />
      <div className="space-y-3.5 p-4">
        <div className="flex justify-between">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-5 w-20" />
        </div>
        <div className="skeleton h-4 w-3/5" />
        <div className="flex justify-between border-t border-[var(--border-subtle)] pt-3">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-3 w-14" />
        </div>
      </div>
    </div>
  );
}

/** The whole MoodStamps page while its board is being read. */
export function MoodStampsPageSkeleton() {
  return (
    <div className="rail pb-16">
      <div className="space-y-3 pt-[clamp(24px,3vw,44px)]" aria-hidden="true">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-12 w-64" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div
        className="mt-[clamp(22px,2.6vw,34px)] flex items-center justify-between border-b border-[var(--border-subtle)] pb-[clamp(18px,2vw,24px)]"
        aria-hidden="true"
      >
        <div className="skeleton h-12 w-52" />
        <div className="skeleton h-12 w-12 sm:w-28" />
      </div>
      <div className="pt-[clamp(28px,3.6vw,56px)]">
        <MoodStampBoardSkeleton count={3} />
      </div>
    </div>
  );
}

export function MoodStampBoardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="ms-grid" aria-busy="true" aria-label="Loading your MoodStamps">
      {Array.from({ length: count }, (_, index) => (
        <MoodStampCardSkeleton key={index} />
      ))}
    </div>
  );
}
