import { CardGridSkeleton } from '@/components/ui/CardSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <div className="mb-8 space-y-3">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-12 w-2/3 rounded-2xl" />
        <div className="skeleton h-4 w-1/2 rounded-full" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
