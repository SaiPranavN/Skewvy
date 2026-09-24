import Link from 'next/link';
import { Wordmark } from './Wordmark';

const BROWSE: Array<[string, string]> = [
  ['/', 'Home'],
  ['/flash-news', 'Stories'],
  ['/entities', 'Profiles'],
  ['/trending', 'Leaderboards'],
  ['/search', 'Search'],
];

/** The two rules the whole product rests on, stated plainly at the bottom. */
const CONTACT_EMAIL = 'team@skewvy.com';

const RULES = [
  'Sentiment applies to decisions and events, not private individuals.',
  'On a Story, a side once taken is final. On a Profile you can change it, and what you already sent still counts.',
];

export function SiteFooter() {
  return (
    <footer className="mt-[clamp(40px,5vw,84px)] border-t border-[var(--border-default)]">
      <div className="rail flex flex-wrap gap-[clamp(20px,3vw,50px)] py-[clamp(26px,3vw,48px)]">
        <div className="min-w-[min(100%,250px)] flex-[1_1_280px]">
          <Wordmark size="sm" />
          <p className="mt-3 max-w-[38ch] text-[14.5px] leading-[1.55] text-secondary">
            Sentiment about decisions and events, not private individuals. Reaction totals measure intensity; opinion
            totals count people.
          </p>
        </div>

        <nav aria-label="Browse" className="flex-[1_1_150px]">
          <h2 className="eyebrow mb-3.5">Browse</h2>
          <ul className="flex flex-col gap-[9px]">
            {BROWSE.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-[14.5px] font-semibold leading-none text-primary transition-colors duration-150 hover:text-brand"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-[1_1_260px]">
          <h2 className="eyebrow mb-3.5">The rules</h2>
          <ul className="flex max-w-[38ch] flex-col gap-[9px] text-sm leading-[1.5] text-secondary">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>

        <div className="flex-[1_1_200px]">
          <h2 className="eyebrow mb-3.5">Contact</h2>
          <p className="max-w-[30ch] text-sm leading-[1.5] text-secondary">
            Questions, corrections, partnerships or anything else — write to us.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-3 inline-block break-all text-[14.5px] font-semibold leading-none text-primary underline decoration-2 underline-offset-4 transition-colors duration-150 hover:text-brand"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
