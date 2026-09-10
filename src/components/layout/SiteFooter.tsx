import Link from 'next/link';
import { SkewvyLogo } from './SkewvyLogo';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/8">
      <div className="mx-auto grid w-full max-w-[1400px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <SkewvyLogo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-haze">
            News tells you what happened. Skewvy shows who got cooked, who earned the medals, and how hard the crowd
            felt it.
          </p>
        </div>

        <nav aria-label="Explore" className="text-sm">
          <h2 className="label-caps mb-3 text-haze-dim">Explore</h2>
          <ul className="space-y-2">
            {[
              ['/flash-news', 'Flash News'],
              ['/entities', 'Entities'],
              ['/trending', 'Trending'],
              ['/search', 'Search'],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-haze transition-colors hover:text-chalk">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm">
          <h2 className="label-caps mb-3 text-haze-dim">The rules</h2>
          <ul className="space-y-2 text-haze">
            <li>Heat is for decisions, not people.</li>
            <li>Reactions measure intensity. Opinions count people.</li>
            <li>All sample content is fictional.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/8 py-6 text-center text-xs text-haze-dim">
        skewvy.com — a global sentiment playground.
      </div>
    </footer>
  );
}
