import { formatCount } from '@/lib/domain/format';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

export interface Stat {
  label: string;
  value: number;
  /** Reaction mark, used only where the stat is a reaction total. */
  mark?: 'egg' | 'medal';
  tone?: 'egg' | 'medal' | 'neutral';
}

const TONE: Record<string, string> = {
  egg: 'text-egg',
  medal: 'text-medal',
  neutral: 'text-primary',
};

/**
 * A row of counted figures. Reaction totals carry their mark; opinion counts
 * do not — an icon there would suggest a third measurement that does not exist.
 */
export function StatBlock({ stats, className = '' }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="border-t border-[var(--border-subtle)] pt-3">
          <dd className={`numeric-lg text-2xl font-semibold ${TONE[stat.tone ?? 'neutral']}`}>
            {stat.mark && (
              <span className="mr-2 align-middle">
                {stat.mark === 'egg' ? <EggIcon size={18} /> : <MedalIcon size={18} />}
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
