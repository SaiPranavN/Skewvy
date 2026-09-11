import { RankedListSkeleton } from '@/components/ui/CardSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6 space-y-3">
        <div className="skeleton h-8 w-44" />
        <div className="skeleton h-4 w-96" />
      </div>
      <RankedListSkeleton count={8} />
    </div>
  );
}
