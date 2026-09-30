'use client';

import { useId, useRef, useState } from 'react';
import { useArtifact } from '@/components/reactions/useArtifact';
import { TrendChart } from './TrendChart';
import { DistributionCharts } from './DistributionCharts';
import { Modal } from '@/components/ui/Modal';
import { MEASUREMENT_NOTE } from '@/lib/domain/copy';
import { RANGE_SPEC, TREND_RANGES, type TrendRange } from '@/lib/domain/trend-ranges';
import type { ArtifactCard } from '@/lib/domain/types';
import type { ArtifactTrends } from '@/lib/services/timeline';

/**
 * Everything the crowd has done to this item, told as two measurements rather
 * than one.
 *
 * The section exists because a single chart of Rotten Eggs against Medals
 * answers a question nobody actually asked. "Which side is winning?" is settled
 * by people, and people are counted once each; "how hard is each side
 * reacting?" is settled by taps, and taps are unlimited. Plotted together they
 * would produce a number with no meaning, so they are drawn separately, on
 * their own axes, each saying in words what one of its points counts.
 *
 * One range picker drives both charts. Two pickers would let the charts drift
 * onto different windows, and the whole value of having them side by side is
 * reading the same stretch of time two ways.
 *
 * The page shows one chart — public opinion, the verdict — so the section
 * reads at a glance. The expand button in its corner opens all four together,
 * on the same range: both histories and both distributions.
 */
export function AnalyticsSection({ card, trends: initial }: { card: ArtifactCard; trends: ArtifactTrends }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const { totals } = state;
  const pickerId = useId();
  const allChartsId = useId();
  const [expanded, setExpanded] = useState(false);

  const [trends, setTrends] = useState<ArtifactTrends>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Only the latest request may land; a slow earlier one must not overwrite it. */
  const latest = useRef(0);

  const changeRange = async (range: TrendRange) => {
    if (range === trends.range) return;
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artifacts/${card.type}/${encodeURIComponent(card.id)}/trends?range=${range}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(String(response.status));
      const next = (await response.json()) as ArtifactTrends;
      if (ticket === latest.current) setTrends(next);
    } catch {
      if (ticket === latest.current) setError('Could not load that range. The charts still show the previous one.');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-[clamp(16px,2vw,26px)] flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 className="display m-0 text-[clamp(26px,3.4vw,48px)]">How this is being read</h2>
        <p className="m-0 max-w-[46ch] text-[14px] font-semibold leading-[1.45] text-secondary">
          {MEASUREMENT_NOTE}
        </p>
      </div>

      <div className="mb-[clamp(12px,1.4vw,18px)] flex flex-wrap items-center gap-3">
        <label htmlFor={pickerId} className="eyebrow">
          Time range
        </label>
        {/*
         * A native select: a dropdown, as asked, with the platform's own
         * keyboard and screen-reader behaviour rather than an imitation of it.
         */}
        <div className="relative">
          <select
            id={pickerId}
            value={trends.range}
            onChange={(event) => void changeRange(event.target.value as TrendRange)}
            aria-describedby={`${pickerId}-status`}
            className="min-h-11 cursor-pointer appearance-none border-2 border-[var(--color-paper)] bg-[var(--color-ground)] py-2.5 pl-3.5 pr-10 text-[14px] font-bold text-primary"
          >
            {TREND_RANGES.map((range) => (
              <option key={range} value={range}>
                {RANGE_SPEC[range].label} — {RANGE_SPEC[range].long}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-primary"
          >
            ▼
          </span>
        </div>
        <span id={`${pickerId}-status`} role="status" className="text-[12.5px] font-medium text-tertiary">
          {loading ? 'Loading…' : error ?? ''}
        </span>
      </div>

      <div className={`transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
        <TrendChart
          trend={trends.opinions}
          title="Public opinion over time"
          unitNote="Each point counts people, once each."
          negativeLabel="Critical"
          positiveLabel="Appreciative"
          liveNegative={totals.negativeOpinionTotal}
          livePositive={totals.positiveOpinionTotal}
          emptyNote="No one has taken a side yet, so there is no history to draw."
          action={<ExpandButton onClick={() => setExpanded(true)} />}
        />
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} labelledBy={allChartsId} size="wide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{RANGE_SPEC[trends.range].long}</p>
            <h2 id={allChartsId} className="display mt-2 text-[clamp(24px,3vw,40px)]">
              Every chart
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close the charts"
            className="flex h-11 w-11 flex-none items-center justify-center border border-[var(--border-strong)] text-[20px] leading-none text-primary transition-colors duration-150 hover:border-[color:var(--color-paper)]"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Two histories, two axes, never one chart. */}
        <div className="mt-[clamp(16px,2vw,24px)] flex flex-wrap items-start gap-[clamp(16px,2.2vw,28px)]">
          <TrendChart
            trend={trends.opinions}
            title="Public opinion over time"
            unitNote="Each point counts people, once each."
            negativeLabel="Critical"
            positiveLabel="Appreciative"
            liveNegative={totals.negativeOpinionTotal}
            livePositive={totals.positiveOpinionTotal}
            emptyNote="No one has taken a side yet, so there is no history to draw."
          />
          <TrendChart
            trend={trends.reactions}
            title="Reaction intensity over time"
            unitNote="Each point counts reaction taps, which are unlimited per person."
            negativeLabel="Rotten Eggs"
            positiveLabel="Medals"
            liveNegative={totals.rottenEggTotal}
            livePositive={totals.medalTotal}
            emptyNote="No reactions yet, so there is no history to draw."
          />
        </div>

        <div className="mt-[clamp(16px,2.2vw,28px)]">
          <DistributionCharts card={card} />
        </div>
      </Modal>
    </div>
  );
}

/** Four corners pointing outward: open every chart. */
function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label="Expand to see every chart"
      title="See every chart"
      className="flex h-10 w-10 flex-none items-center justify-center border border-[var(--rule-default)] text-ink transition-colors duration-150 hover:border-ink hover:bg-[rgb(23_20_15_/_0.06)]"
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 7V2h5M11 2h5v5M16 11v5h-5M7 16H2v-5" strokeLinecap="square" />
      </svg>
    </button>
  );
}
