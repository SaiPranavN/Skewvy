import Link from 'next/link';
import { Wordmark } from './Wordmark';
import { POLICY_LINKS } from '@/components/legal/PolicyPage';

const BROWSE: Array<[string, string]> = [
  ['/', 'Home'],
  ['/flash-news', 'Stories'],
  ['/entities', 'Profiles'],
  ['/trending', 'Leaderboards'],
  ['/search', 'Search'],
];

/**
 * Two quiet rows: where to go, then what the numbers are and where the
 * rules live. One sentence of explanation, no more — the detail is one click
 * away on the pages it links to.
 */
export function SiteFooter() {
  return (
    <footer className="mt-[clamp(40px,5vw,84px)] border-t border-[var(--border-default)]">
      <div className="rail py-[clamp(22px,2.6vw,36px)]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Wordmark size="sm" />
          <nav aria-label="Browse" className="-mx-2 flex flex-wrap">
            {BROWSE.map(([href, label]) => (
              <Link key={href} href={href} className="footer-link text-primary">
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-[var(--border-subtle)] pt-4">
          <p className="m-0 max-w-[60ch] text-[13.5px] leading-[1.5] text-secondary">
            Skewvy measures user sentiment, not facts or representative public opinion.
          </p>
          <nav aria-label="Policies and contact" className="-mx-2 flex flex-wrap">
            {POLICY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="footer-link text-secondary">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
