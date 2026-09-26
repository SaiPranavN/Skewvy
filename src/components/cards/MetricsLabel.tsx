import { InfoTip, METRICS_EXPLAINER } from '@/components/ui/InfoTip';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * "614 people · 12,840 reactions", with the ⓘ that says why those are two
 * different numbers. The explanation lives in the popover so it is one tap
 * away on every card without being printed on every card.
 */
export function MetricsLabel({ totals, className = '' }: { totals: ArtifactTotals; className?: string }) {
  const people = totals.positiveOpinionTotal + totals.negativeOpinionTotal;
  const reactions = totals.medalTotal + totals.rottenEggTotal;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold leading-none text-secondary ${className}`}>
      <span className="numeric">
        {formatCount(people)} {people === 1 ? 'person' : 'people'} · {formatCount(reactions)}{' '}
        {reactions === 1 ? 'reaction' : 'reactions'}
      </span>
      <InfoTip text={METRICS_EXPLAINER} align="start" tone="paper" />
    </span>
  );
}
