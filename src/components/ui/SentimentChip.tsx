import { sentimentLabel } from '@/lib/domain/copy';
import type { ArtifactTotals } from '@/lib/domain/types';

const TONES: Record<string, string> = {
  egg: 'bg-egg/16 text-egg border-egg/25',
  medal: 'bg-medal/16 text-medal border-medal/25',
  split: 'bg-white/10 text-chalk-dim border-white/18',
  neutral: 'bg-white/7 text-haze border-white/12',
};

/** State label plus a shape cue, so colour is never the only signal. */
export function SentimentChip({ totals }: { totals: ArtifactTotals }) {
  const label = sentimentLabel(totals);
  const marker = label.tone === 'egg' ? '🥚' : label.tone === 'medal' ? '🏅' : '⚖️';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] ${TONES[label.tone]}`}
    >
      <span className="emoji text-[0.8125rem]" aria-hidden="true">
        {marker}
      </span>
      {label.label}
    </span>
  );
}
