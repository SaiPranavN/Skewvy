'use client';

import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { formatCount, sharePercent } from '@/lib/domain/format';
import { InfoTip, METRICS_EXPLAINER } from '@/components/ui/InfoTip';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Where the crowd stands on a Story, beside its headline: two bars and
 * nothing else. The first is people — for and against, each counted once.
 * The second is reactions — Medals against Rotten Eggs, counted in taps.
 * Live: both move as reactions arrive, like every other total.
 */
export function LiveTally({ card }: { card: ArtifactCard }) {
  const { totals } = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const badge = cardTone(totals);
  const people = totals.positiveOpinionTotal + totals.negativeOpinionTotal;
  const taps = totals.medalTotal + totals.rottenEggTotal;

  return (
    <aside aria-labelledby={`${card.id}-tally-heading`} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${card.id}-tally-heading`} className="eyebrow m-0 inline-flex items-center gap-1.5">
          Live tally
          <InfoTip text={METRICS_EXPLAINER} align="start" />
        </h2>
        <span className={`tone-${badge.tone} tone-badge`}>{badge.flashLabel}</span>
      </div>

      <TallyBar
        title="Opinion"
        caption={people === 0 ? 'No one yet' : `${formatCount(people)} ${people === 1 ? 'person' : 'people'}`}
        left={{ label: 'Positive', mark: '▲', count: totals.positiveOpinionTotal, colour: 'var(--color-positive)' }}
        right={{ label: 'Negative', mark: '▼', count: totals.negativeOpinionTotal, colour: 'var(--color-negative)' }}
      />

      <TallyBar
        title="Reactions"
        caption={taps === 0 ? 'None yet' : `${formatCount(taps)} ${taps === 1 ? 'tap' : 'taps'}`}
        left={{ label: 'Medals', mark: '🏅', count: totals.medalTotal, colour: 'var(--color-medal)' }}
        right={{ label: 'Rotten Eggs', mark: '🥚', count: totals.rottenEggTotal, colour: 'var(--color-egg)' }}
      />
    </aside>
  );
}

interface Side {
  label: string;
  mark: string;
  count: number;
  colour: string;
}

/** One horizontal bar: the left side's share from the left, the right side's the rest. */
function TallyBar({ title, caption, left, right }: { title: string; caption: string; left: Side; right: Side }) {
  const whole = left.count + right.count;
  const leftShare = whole > 0 ? sharePercent(left.count, whole) : 0;
  const rightShare = whole > 0 ? 100 - leftShare : 0;

  return (
    <div
      role="group"
      aria-label={
        whole === 0
          ? `${title}: nothing yet.`
          : `${title}: ${formatCount(left.count)} ${left.label} (${leftShare}%), ${formatCount(right.count)} ${right.label} (${rightShare}%).`
      }
    >
      <div className="flex items-baseline justify-between gap-3" aria-hidden="true">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-tertiary">{title}</span>
        <span className="text-[11.5px] font-semibold text-tertiary">{caption}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3" aria-hidden="true">
        <Figure side={left} share={whole > 0 ? leftShare : null} />
        <Figure side={right} share={whole > 0 ? rightShare : null} alignEnd />
      </div>

      <div className="mt-2 flex h-2.5 gap-[3px] overflow-hidden bg-[var(--color-surface-3)]" aria-hidden="true">
        {left.count > 0 && <span className="block h-full" style={{ width: `${leftShare}%`, backgroundColor: left.colour }} />}
        {right.count > 0 && <span className="block h-full flex-1" style={{ backgroundColor: right.colour }} />}
      </div>
    </div>
  );
}

function Figure({ side, share, alignEnd = false }: { side: Side; share: number | null; alignEnd?: boolean }) {
  const emoji = side.mark.length > 1;
  return (
    <span className={`min-w-0 ${alignEnd ? 'text-right' : ''}`}>
      <span className="numeric-lg block text-[24px] leading-none" style={{ color: side.colour }}>
        {formatCount(side.count)}
      </span>
      <span className="mt-1.5 block truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-secondary">
        <span className={emoji ? 'emoji' : ''} style={emoji ? undefined : { color: side.colour }}>
          {side.mark}
        </span>{' '}
        {side.label}
        {share !== null && ` · ${share}%`}
      </span>
    </span>
  );
}
