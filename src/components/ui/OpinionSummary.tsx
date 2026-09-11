import { formatCount, sharePercent } from '@/lib/domain/format';
import { MEASUREMENT_NOTE } from '@/lib/domain/copy';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * Public opinion — people, not taps.
 *
 * Deliberately quieter than the reaction totals: the counts are set at body
 * size so they read as supporting evidence rather than competing with the
 * headline numbers above them.
 */
export function SentimentBalance({ totals, className = '' }: { totals: ArtifactTotals; className?: string }) {
  const negative = totals.negativeOpinionTotal;
  const positive = totals.positiveOpinionTotal;
  const people = negative + positive;
  const negativeShare = sharePercent(negative, people);

  return (
    <div
      className={`flex h-1 w-full overflow-hidden rounded-full bg-surface-3 ${className}`}
      role="img"
      aria-label={`Public opinion: ${formatCount(negative)} people critical, ${formatCount(positive)} people appreciative.`}
    >
      <div className="h-full bg-egg-muted" style={{ width: `${people > 0 ? negativeShare : 0}%` }} />
      <div className="h-full flex-1 bg-medal-muted" />
    </div>
  );
}

export function OpinionSummary({
  totals,
  showNote = true,
  className = '',
}: {
  totals: ArtifactTotals;
  showNote?: boolean;
  className?: string;
}) {
  const negative = totals.negativeOpinionTotal;
  const positive = totals.positiveOpinionTotal;
  const people = negative + positive;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-medium text-primary">Public opinion</h3>
        <p className="numeric text-xs text-tertiary">{formatCount(totals.uniqueParticipantTotal)} people</p>
      </div>

      <SentimentBalance totals={totals} className="mt-3" />

      <dl className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-sm">
        <div className="flex items-baseline gap-2">
          <dt className="text-secondary">Critical</dt>
          <dd className="numeric font-medium text-primary">{formatCount(negative)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-secondary">Appreciative</dt>
          <dd className="numeric font-medium text-primary">{formatCount(positive)}</dd>
        </div>
        {people > 0 && (
          <div className="flex items-baseline gap-2">
            <dt className="sr-only">Split</dt>
            <dd className="numeric text-xs text-tertiary">
              {sharePercent(negative, people)}% / {100 - sharePercent(negative, people)}%
            </dd>
          </div>
        )}
      </dl>

      {showNote && <p className="mt-3 text-xs leading-relaxed text-tertiary">{MEASUREMENT_NOTE}</p>}
    </div>
  );
}

/** Compact inline variant for feed cards. */
export function OpinionLine({ totals, className = '' }: { totals: ArtifactTotals; className?: string }) {
  return (
    <p className={`text-xs text-tertiary ${className}`}>
      <span className="numeric text-secondary">{formatCount(totals.negativeOpinionTotal)}</span> critical ·{' '}
      <span className="numeric text-secondary">{formatCount(totals.positiveOpinionTotal)}</span> appreciative ·{' '}
      <span className="numeric text-secondary">{formatCount(totals.uniqueParticipantTotal)}</span> people
    </p>
  );
}
