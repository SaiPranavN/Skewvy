import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-24 sm:py-32">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-primary">Page not found</h1>
      <p className="mt-3 text-sm leading-relaxed text-secondary">
        That page has been unpublished, archived, or never existed.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/flash-news"
          className="min-h-11 rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
        >
          Browse Stories
        </Link>
        <Link
          href="/"
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
