import { RelativeTime } from '@/components/ui/TimeAgo';
import { formatCount } from '@/lib/domain/format';
import type { ReactionType } from '@/lib/domain/types';
import { ReactionMark } from '@/components/ui/icons';

export interface RecentActivityItem {
  reactionType: ReactionType;
  quantity: number;
  createdAt: string;
}

/**
 * Recent activity, on the ground rather than on paper — it is a live margin
 * note beside the opinion panel, not a document of its own.
 *
 * Rows are already grouped per person per burst by the service, so "+24" is one
 * person's session rather than twenty-four separate lines.
 */
export function RecentActivityPanel({ activity }: { activity: RecentActivityItem[] }) {
  return (
    <aside
      aria-labelledby="activity-heading"
      className="min-w-[min(100%,280px)] max-w-[420px] flex-[1_1_300px] border border-[var(--border-default)] p-[clamp(18px,2vw,26px)]"
    >
      <h2 id="activity-heading" className="display-sm m-0 text-[clamp(20px,2vw,28px)]">
        Recent activity
      </h2>
      <p className="m-0 mb-[18px] mt-2 text-[13px] leading-[1.5] text-tertiary">
        The latest reactions on this item. Repeats from one person are grouped.
      </p>

      {activity.length === 0 ? (
        <p className="border-t border-[var(--border-subtle)] pt-3 text-sm text-secondary">
          Nothing yet. The first reaction shows up here.
        </p>
      ) : (
        <ul className="flex flex-col">
          {activity.map((item, index) => {
            const isEgg = item.reactionType === 'rotten_egg';
            return (
              <li
                key={`${item.createdAt}-${index}`}
                className="flex items-center gap-[11px] border-t border-[var(--border-subtle)] py-3"
              >
                <ReactionMark reactionType={item.reactionType} size={17} className="flex-none" />
                <span
                  className={`numeric min-w-[38px] flex-none text-[15.5px] font-extrabold leading-none ${
                    isEgg ? 'text-brand' : 'text-medal'
                  }`}
                >
                  +{formatCount(item.quantity)}
                </span>
                <span className="min-w-0 text-[13.5px] leading-[1.35] text-secondary">
                  {isEgg ? 'Rotten eggs' : 'Medals'} from one person
                </span>
                <RelativeTime
                  iso={item.createdAt}
                  className="ml-auto flex-none text-[11px] font-medium uppercase leading-none tracking-[0.06em] text-tertiary"
                />
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
