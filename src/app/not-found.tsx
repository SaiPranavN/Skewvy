import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-24 text-center sm:py-32">
      <p className="emoji text-5xl" aria-hidden="true">
        🥚
      </p>
      <h1 className="mt-6 text-balance text-3xl font-black tracking-[-0.02em] text-chalk sm:text-4xl">
        Nothing to react to here
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-haze">
        That page has been unpublished, archived, or never existed. The crowd has moved on.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/flash-news"
          className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
        >
          See what&apos;s catching fire
        </Link>
        <Link
          href="/"
          className="rounded-full border border-white/14 px-5 py-3 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
