'use client';

import { useId } from 'react';
import { useArtifact } from '@/components/reactions/useArtifact';
import { ReactionMark } from '@/components/ui/icons';
import { formatCount, sharePercent } from '@/lib/domain/format';
import { contributorPhrase, intensityComparison } from '@/lib/domain/copy';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * The two distributions, side by side, and the sentence that reconciles them.
 *
 * Deliberately the same shape twice — two vertical bars, exact figures printed
 * on them — so the comparison is immediate and the difference between them is
 * carried entirely by their labels. The left chart is the verdict: how many
 * people are on each side. The right chart is the volume: how many taps each
 * side sent, and how many people are behind those taps.
 *
 * These wear the chart palette rather than the brand one — red for the
 * critical direction, green for the appreciative — because they sit directly
 * under two line charts saying the same thing, and the same figure in two
 * colours a few hundred pixels apart would read as two different figures.
 *
 * The right chart is never allowed to read as the verdict. It is titled
 * "intensity", every total carries its head count, and the sentence underneath
 * states the relationship between the two in plain words — which matters most
 * exactly when they disagree, because that is the case a reader would otherwise
 * get wrong.
 */
export function DistributionCharts({ card }: { card: ArtifactCard }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const { totals } = state;

  const critical = totals.negativeOpinionTotal;
  const appreciative = totals.positiveOpinionTotal;
  const people = critical + appreciative;

  const eggs = totals.rottenEggTotal;
  const medals = totals.medalTotal;
  const reactions = eggs + medals;

  return (
    <div>
      <div className="flex flex-wrap items-start gap-[clamp(16px,2.2vw,32px)]">
        <Panel
          title="Public opinion"
          kicker="The verdict"
          note="Every person counted once, however hard they tapped."
          summary={
            people === 0
              ? 'Nobody has taken a side yet.'
              : `${formatCount(people)} ${people === 1 ? 'person has' : 'people have'} taken a side.`
          }
          bars={[
            {
              key: 'appreciative',
              label: 'Appreciative',
              value: appreciative,
              share: people > 0 ? sharePercent(appreciative, people) : 0,
              caption: appreciative === 1 ? '1 person' : `${formatCount(appreciative)} people`,
              tone: 'medal',
            },
            {
              key: 'critical',
              label: 'Critical',
              value: critical,
              share: people > 0 ? sharePercent(critical, people) : 0,
              caption: critical === 1 ? '1 person' : `${formatCount(critical)} people`,
              tone: 'egg',
            },
          ]}
        />

        <Panel
          title="Reaction intensity"
          kicker="The volume"
          note="Taps, not people. One person can send hundreds of these."
          summary={
            reactions === 0
              ? 'No reactions sent yet.'
              : `${formatCount(reactions)} ${reactions === 1 ? 'reaction' : 'reactions'} in total.`
          }
          bars={[
            {
              key: 'medals',
              label: 'Medals',
              value: medals,
              share: reactions > 0 ? sharePercent(medals, reactions) : 0,
              caption: contributorPhrase('medal', totals.medalContributorTotal),
              tone: 'medal',
              mark: 'medal',
            },
            {
              key: 'eggs',
              label: 'Rotten Eggs',
              value: eggs,
              share: reactions > 0 ? sharePercent(eggs, reactions) : 0,
              caption: contributorPhrase('rotten_egg', totals.rottenEggContributorTotal),
              tone: 'egg',
              mark: 'egg',
            },
          ]}
        />
      </div>

      <p className="m-0 mt-[clamp(14px,1.8vw,22px)] max-w-[62ch] text-[clamp(15px,1.3vw,19px)] font-bold leading-[1.4] text-primary">
        {intensityComparison(totals)}
      </p>
    </div>
  );
}

interface Bar {
  key: string;
  label: string;
  value: number;
  share: number;
  caption: string;
  tone: 'egg' | 'medal';
  mark?: 'egg' | 'medal';
}

function Panel({
  title,
  kicker,
  note,
  summary,
  bars,
}: {
  title: string;
  kicker: string;
  note: string;
  summary: string;
  bars: Bar[];
}) {
  const titleId = useId();

  /*
   * Bars are scaled against the larger of the two rather than the total, so the
   * winning bar always fills the plot and the loser's height is its honest
   * ratio to it. A bar with a real value never collapses to nothing: it keeps a
   * visible stub, because "few" and "none" must not look the same.
   */
  const peak = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <section
      aria-labelledby={titleId}
      className="paper min-w-[min(100%,280px)] flex-[1_1_340px] p-[clamp(18px,2.2vw,32px)]"
    >
      <p className="eyebrow-ink">{kicker}</p>
      <h3 id={titleId} className="display-sm m-0 mt-2 text-[clamp(19px,2.1vw,28px)]">
        {title}
      </h3>
      <p className="m-0 mt-2 max-w-[40ch] text-[12.5px] leading-[1.45] text-[rgb(23_20_15_/_0.66)]">{note}</p>

      <div
        className="mt-[clamp(16px,2vw,24px)] grid grid-cols-2 gap-[clamp(10px,1.4vw,18px)]"
        role="img"
        aria-label={`${title}. ${bars.map((bar) => `${bar.label}: ${formatCount(bar.value)}, ${bar.caption}`).join('. ')}.`}
      >
        {bars.map((bar) => (
          <div key={bar.key} className="min-w-0">
            {/*
             * A fixed track gives the percentage something real to resolve
             * against — a bar sized as a share of its own content box would be
             * circular and collapse.
             */}
            <div className="flex h-[clamp(120px,13vw,170px)] flex-col justify-end">
              <div className="numeric-lg text-[clamp(21px,2.5vw,32px)] leading-none">{formatCount(bar.value)}</div>
              <div
                className="mt-2 w-full border-2 border-ink"
                style={{
                  height: `max(10px, ${Math.round((bar.value / peak) * 76)}%)`,
                  backgroundColor:
                    bar.tone === 'egg' ? 'var(--color-series-negative)' : 'var(--color-series-positive)',
                }}
              />
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-bold uppercase leading-[1.2] tracking-[0.06em]">
              {bar.mark && <ReactionMark reactionType={bar.mark === 'egg' ? 'rotten_egg' : 'medal'} size={13} />}
              {bar.label}
            </div>
            <div className="mt-1 text-[11.5px] font-medium leading-[1.35] text-[rgb(23_20_15_/_0.66)]">
              {bar.caption}
              {bar.share > 0 && ` · ${bar.share}%`}
            </div>
          </div>
        ))}
      </div>

      <p className="m-0 mt-4 border-t border-[var(--rule-subtle)] pt-3.5 text-[12.5px] font-semibold leading-[1.4]">
        {summary}
      </p>
    </section>
  );
}
