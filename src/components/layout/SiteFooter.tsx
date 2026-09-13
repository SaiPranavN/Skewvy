import Link from 'next/link';
import { Wordmark } from './Wordmark';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--border-subtle)]">
      <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr] lg:px-8">
        <div>
          <Wordmark size="sm" />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-secondary">
            A public sentiment index. Reaction totals measure intensity; public opinion counts each person once.
          </p>
        </div>

        <nav aria-label="Explore" className="text-sm">
          <h2 className="eyebrow mb-3">Explore</h2>
          <ul className="space-y-2">
            {[
              ['/flash-news', 'Flash News'],
              ['/entities', 'Entities'],
              ['/trending', 'Trending'],
              ['/search', 'Search'],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-secondary transition-colors duration-150 hover:text-primary">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm">
          <h2 className="eyebrow mb-3">About the data</h2>
          <ul className="space-y-2 text-secondary">
            <li>Reactions count taps. Opinions count people.</li>
            <li>Sentiment applies to decisions and events, not private individuals.</li>
            <li>A side, once taken, is final. Reactions after it must agree with it.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] py-6">
        <p className="mx-auto w-full max-w-[1320px] px-4 text-xs text-tertiary sm:px-6 lg:px-8">skewvy.com</p>
      </div>
    </footer>
  );
}
