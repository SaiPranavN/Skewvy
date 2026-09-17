'use client';

import { useArtifact } from '@/components/reactions/useArtifact';
import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Public opinion — people, not taps.
 *
 * Two solid blocks whose widths are the split itself, so the shape of the
 * disagreement reads before any of the numbers do. Neither side is ever allowed
 * to collapse below a readable width, so a 99/1 split still shows both labels.
 *
 * The line underneath is the point of the whole panel: a large reaction total
 * and a small opinion count are not in conflict, they are measuring different
 * things.
 */
export function PublicOpinionPanel({ card }: { card: ArtifactCard }) {
  const state = useArtifact(card.type, card.id, {
    totals: card.totals,
    contribution: card.contribution,
  });
  const { totals, contribution } = state;

  const critical = totals.negativeOpinionTotal;
  const appreciative = totals.positiveOpinionTotal;
  const people = critical + appreciative;

  const criticalPct = people > 0 ? sharePercent(critical, people) : 50;
  const appreciativePct = 100 - criticalPct;

  /** Flex weights, floored so a lopsided split still shows both labels. */
  const criticalWeight = Math.max(criticalPct, 18);
  const appreciativeWeight = Math.max(appreciativePct, 18);

  const criticWord = critical === 1 ? 'One critic' : `${formatCount(critical)} critics`;
  const honestLine = `${formatCount(totals.rottenEggTotal)} eggs. ${criticWord}. Different numbers, different stories.`;

  const own = contribution.rottenEggCount + contribution.medalCount;
  const yourLine = contribution.stance
    ? `Your side: ${contribution.stance === 'negative' ? 'critical' : 'appreciative'}, recorded once and final. ` +
      `${formatCount(contribution.stance === 'negative' ? contribution.rottenEggCount : contribution.medalCount)} of the ` +
      `${contribution.stance === 'negative' ? 'eggs' : 'medals'} above are yours.`
    : own > 0
      ? 'Your reactions are counted above.'
      : 'You have not taken a side on this one.';

  return (
    <div className="paper min-w-[min(100%,300px)] flex-[1_1_480px] p-[clamp(20px,2.6vw,40px)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display-sm m-0 text-[clamp(24px,2.8vw,40px)]">Public opinion</h2>
        <span className="text-xs font-bold uppercase leading-none tracking-[0.1em] text-[rgb(23_20_15_/_0.62)]">
          {people === 1 ? '1 person' : `${formatCount(people)} people`} with a side
        </span>
      </div>

      <p className="m-0 mb-5 mt-3 max-w-[56ch] text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.66)]">
        Unique people, counted once each, no matter how hard they tapped.
      </p>

      <div
        className="flex min-h-[clamp(120px,13vw,160px)] border border-[var(--rule-default)]"
        role="img"
        aria-label={`Public opinion: ${formatCount(critical)} people critical, ${formatCount(appreciative)} people appreciative.`}
      >
        <OpinionBlock
          label="Critical"
          count={critical}
          people={people}
          percent={criticalPct}
          weight={criticalWeight}
          className="bg-egg"
        />
        <OpinionBlock
          label="Appreciative"
          count={appreciative}
          people={people}
          percent={appreciativePct}
          weight={appreciativeWeight}
          className="bg-medal items-end text-right"
        />
      </div>

      <p className="m-0 mt-[18px] max-w-[54ch] text-[clamp(15px,1.2vw,18px)] font-bold leading-[1.45]">{honestLine}</p>
      <p className="m-0 mt-2 max-w-[56ch] text-[13px] leading-[1.5] text-[rgb(23_20_15_/_0.6)]">{yourLine}</p>
    </div>
  );
}

function OpinionBlock({
  label,
  count,
  people,
  percent,
  weight,
  className,
}: {
  label: string;
  count: number;
  people: number;
  percent: number;
  weight: number;
  className: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col justify-between p-4 ${className}`} style={{ flex: `${weight} 1 0%` }}>
      <span className="text-[11px] font-bold uppercase leading-[1.2] tracking-[0.12em] text-ink">{label}</span>
      <span
        className="numeric-lg text-ink"
        style={{
          fontSize: 'clamp(40px,5vw,72px)',
          lineHeight: 0.85,
          letterSpacing: '-0.045em',
        }}
      >
        {formatCount(count)}
      </span>
      <span className="text-xs font-medium leading-[1.3] text-[rgb(23_20_15_/_0.82)]">
        {count === 1 ? '1 person' : `${formatCount(count)} people`}
        {people > 0 && ` · ${percent}%`}
      </span>
    </div>
  );
}
