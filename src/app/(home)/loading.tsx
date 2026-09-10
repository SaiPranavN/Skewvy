/*
 * This loading skeleton lives inside a route group on purpose.
 *
 * `loading.tsx` cascades to every nested segment without its own, and a
 * streamed shell commits an HTTP 200 before a page can call `notFound()` — so
 * placed at the app root it would make every missing artifact answer 200
 * instead of 404. The group scopes it to the home page alone.
 */
import { CardGridSkeleton } from '@/components/ui/CardSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10">
      <div className="mb-12 space-y-4">
        <div className="skeleton h-3 w-40 rounded-full" />
        <div className="skeleton h-20 w-full max-w-2xl rounded-3xl" />
        <div className="skeleton h-4 w-1/2 rounded-full" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
