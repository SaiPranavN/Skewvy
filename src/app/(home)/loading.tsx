/*
 * This skeleton lives inside a route group on purpose.
 *
 * `loading.tsx` cascades to every nested segment without its own, and a
 * streamed shell commits an HTTP 200 before a page can call `notFound()` — so
 * placed at the app root it would make every missing artifact answer 200
 * instead of 404. The group scopes it to the home page alone.
 */
import { CardGridSkeleton } from '@/components/ui/CardSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6 space-y-3">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-4 w-80" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
