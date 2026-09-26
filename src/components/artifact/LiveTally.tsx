'use client';

import { Media, initialsFor } from '@/components/ui/Media';
import { useArtifact } from '@/components/reactions/useArtifact';
import { SentimentLine } from '@/components/cards/SentimentLine';
import { cardTone, intensityComparison } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import { ReactionLine } from './ReactionLine';
import { InfoTip, METRICS_EXPLAINER } from '@/components/ui/InfoTip';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * The panel beside a Story's headline: its picture at ordinary card size, and
 * where the crowd stands right now — Medals against Rotten Eggs as a line,
 * people for and against as a second line, and one sentence reading the two
 * together. Live: it moves as reactions arrive, like every other total.
 */
export function LiveTally({ card, imageLabel }: { card: ArtifactCard; imageLabel: string }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const totals = state.totals;
  const badge = cardTone(totals);
  const taps = totals.medalTotal + totals.rottenEggTotal;

  return (
    <aside
      aria-labelledby={`${card.id}-tally-heading`}
      className={`paper tone-${badge.tone} border-2 border-ink`}
      style={{ boxShadow: '8px 8px 0 var(--tone, var(--color-ink))' }}
    >
      <Media
        src={card.imageUrl}
        alt=""
        fallbackLabel={initialsFor(imageLabel)}
        fallbackKind="initials"
        sizes="(max-width: 1024px) 100vw, 440px"
        priority
        className="aspect-[16/9] w-full border-b-2 border-ink"
      />

      <div className="space-y-5 p-[clamp(16px,1.8vw,22px)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${card.id}-tally-heading`} className="eyebrow-ink m-0 inline-flex items-center gap-1.5">
            Live tally
            <InfoTip text={METRICS_EXPLAINER} align="start" tone="paper" />
          </h2>
          <span className="tone-badge">{badge.flashLabel}</span>
        </div>

        <div>
          <p className="m-0 mb-2 text-[11px] font-bold uppercase leading-none tracking-[0.1em] text-tertiary">
            Reactions · {formatCount(taps)} {taps === 1 ? 'tap' : 'taps'}
          </p>
          <ReactionLine totals={totals} />
        </div>

        <div>
          <p className="m-0 mb-2 text-[11px] font-bold uppercase leading-none tracking-[0.1em] text-tertiary">People</p>
          <SentimentLine totals={totals} />
        </div>

        <p className="m-0 border-t border-[var(--rule-subtle)] pt-4 text-[13.5px] font-semibold leading-[1.5] text-primary">
          {intensityComparison(totals)}
        </p>
      </div>
    </aside>
  );
}
