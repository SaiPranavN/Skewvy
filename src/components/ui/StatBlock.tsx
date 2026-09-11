import { formatCount } from '@/lib/domain/format';

export interface Stat {
  label: string;
  value: number;
  /** Reaction emoji, used only where the stat is a reaction total. */
  emoji?: string;
  tone?: 'egg' | 'medal' | 'neutral';
}

const TONE: Record<string, string> = {
  egg: 'text-egg',
  medal: 'text-medal',
  neutral: 'text-primary',
};

/**
 * A row of counted figures. Reaction totals carry their emoji; opinion counts
 * do not — an icon there would suggest a third measurement that does not exist.
 */
export function StatBlock({ stats, className = '' }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="border-t border-[var(--border-subtle)] pt-3">
          <dd className={`numeric-lg text-2xl font-semibold ${TONE[stat.tone ?? 'neutral']}`}>
            {stat.emoji && (
              <span className="emoji mr-2 align-middle text-sm" aria-hidden="true">
                {stat.emoji}
              </span>
            )}
            {formatCount(stat.value)}
          </dd>
          <dt className="mt-1 text-sm text-secondary">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
