import { sentimentLabel } from '@/lib/domain/copy';
import type { ArtifactTotals, ArtifactType } from '@/lib/domain/types';

const DOT_TONE: Record<string, string> = {
  egg: 'bg-egg',
  medal: 'bg-medal',
  neutral: 'bg-tertiary',
};

/**
 * Sentiment state, shown as a small dot and a factual label rather than a
 * coloured pill. The label text carries the meaning, so the dot is redundant
 * reinforcement rather than the only signal.
 */
export function SentimentMarker({ totals, className = '' }: { totals: ArtifactTotals; className?: string }) {
  const label = sentimentLabel(totals);

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-secondary ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 ${DOT_TONE[label.tone]}`} />
      {label.label}
    </span>
  );
}

/** Plain text artifact type. No badge, no container. */
export function TypeLabel({ type, className = '' }: { type: ArtifactType; className?: string }) {
  return <span className={`eyebrow ${className}`}>{type === 'entity' ? 'Profile' : 'Story'}</span>;
}

/** A metadata row: category, time, related links — separated by thin bullets. */
export function MetaRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary ${className}`}>{children}</div>
  );
}

export function MetaDot() {
  return (
    <span aria-hidden="true" className="text-disabled">
      ·
    </span>
  );
}
