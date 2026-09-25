import Link from 'next/link';
import { CardCarousel } from '@/components/cards/CardCarousel';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard } from '@/lib/domain/types';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

export interface SiteTotals {
  eggs: number;
  medals: number;
  people: number;
}

/**
 * The landing hero: the promise on the left, live items on the right.
 *
 * There is no photograph behind it. The headline is the image — set large
 * enough that the two coloured words carry the whole proposition — and the
 * space a stock photo would have taken is given to a row of real cards the
 * visitor can page through. They are the catalogue cards at catalogue size, so
 * no image is ever stretched past the resolution it was made for.
 */
export function Hero({
  featured,
  totals,
  isAuthenticated,
}: {
  featured: ArtifactCard[];
  totals: SiteTotals;
  isAuthenticated: boolean;
}) {
  return (
    <section className="rail pt-[clamp(28px,4vw,72px)]">
      <div className="flex flex-wrap items-start gap-[clamp(28px,4vw,72px)]">
        <div className="min-w-[min(100%,320px)] flex-[1_1_520px]">
          <div className="flex items-center gap-4">
            <p className="eyebrow whitespace-nowrap text-[color:var(--color-indigo-soft)]">A public sentiment index</p>
            <span aria-hidden="true" className="h-px w-[clamp(40px,8vw,120px)] bg-[var(--border-strong)]" />
          </div>

          <h1 className="display mt-[clamp(18px,2.4vw,34px)] text-[clamp(44px,6.6vw,104px)]">
            Throw eggs at what deserves it.{' '}
            <span className="text-medal">Hand medals</span> to what earned it.
          </h1>

          <p className="mt-[clamp(20px,2.4vw,34px)] max-w-[52ch] text-[clamp(16px,1.3vw,21px)] leading-[1.5] text-secondary">
            Decisions, releases, patches, policies, questionable rebrands. Pick a side once, then react as much as your
            thumb can stand.
          </p>

          <div className="mt-[clamp(22px,2.6vw,36px)] flex flex-wrap gap-3">
            <Link
              href={isAuthenticated ? '/flash-news' : '/register'}
              className="btn bg-egg px-6 py-4 text-[15px] font-extrabold text-ink"
            >
              Start reacting
            </Link>
            <Link href="#how-it-works" className="btn btn-outline px-6 py-4 text-[15px] font-extrabold">
              How it works
            </Link>
          </div>
        </div>

        {featured.length > 0 && (
          <div className="min-w-0 max-w-[720px] flex-[1_1_380px]">
            <CardCarousel cards={featured} label="Featured right now" priorityCount={2} />
          </div>
        )}
      </div>

      <dl className="mt-[clamp(32px,4vw,64px)] flex flex-wrap gap-x-[clamp(28px,4vw,64px)] gap-y-5 border-t border-[var(--border-default)] pt-[clamp(20px,2.4vw,32px)]">
        <SiteStat value={totals.eggs} label="Eggs thrown" mark="egg" className="text-brand" />
        <SiteStat value={totals.medals} label="Medals given" mark="medal" className="text-medal" />
        <SiteStat value={totals.people} label="People with a side" className="text-primary" />
      </dl>
    </section>
  );
}

function SiteStat({
  value,
  label,
  mark,
  className,
}: {
  value: number;
  label: string;
  mark?: 'egg' | 'medal';
  className: string;
}) {
  return (
    <div>
      <dd className={`numeric-lg text-[clamp(28px,3.2vw,44px)] ${className}`}>{formatCount(value)}</dd>
      <dt className="mt-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-tertiary">
        {label} {mark === 'egg' ? <EggIcon /> : mark === 'medal' ? <MedalIcon /> : null}
      </dt>
    </div>
  );
}
