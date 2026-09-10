'use client';

import { ReactionZone } from '@/components/reactions/ReactionZone';
import { CrowdPulse } from '@/components/reactions/CrowdPulse';
import { SentimentBar } from '@/components/ui/SentimentBar';
import { useArtifact } from '@/components/reactions/useArtifact';
import { formatCount } from '@/lib/domain/format';
import { RelativeTime } from '@/components/ui/TimeAgo';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';

export interface RecentActivityItem {
  reactionType: ReactionType;
  quantity: number;
  createdAt: string;
}

/**
 * The visual centrepiece of an artifact page: two oversized counters, then the
 * viewer's own contribution, the opinion split and recent activity beneath.
 */
export function SentimentPanel({
  card,
  activity,
  anchorId,
}: {
  card: ArtifactCard;
  activity: RecentActivityItem[];
  anchorId: string;
}) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const own = state.contribution;
  const hasContributed = own.rottenEggCount > 0 || own.medalCount > 0;

  const stanceLabel =
    own.stance === 'negative' ? 'Frustrated' : own.stance === 'positive' ? 'Appreciative' : 'No opinion yet';

  return (
    <section aria-labelledby="sentiment-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sentiment-heading" className="text-lg font-bold text-chalk">
          How the crowd feels
        </h2>
        <CrowdPulse
          artifactType={card.type}
          artifactId={card.id}
          totals={card.totals}
          contribution={card.contribution}
        />
      </div>

      <div id={anchorId} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReactionZone
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="rotten_egg"
          totals={card.totals}
          contribution={card.contribution}
          microcopy="Make the counter sweat."
        />
        <ReactionZone
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="medal"
          totals={card.totals}
          contribution={card.contribution}
          microcopy="Give credit where it’s due."
        />
      </div>

      <div className="glass rounded-[var(--radius-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-caps text-haze-dim">Your contribution</p>
            {hasContributed ? (
              <p className="mt-1.5 text-base text-chalk">
                You sent{' '}
                {own.rottenEggCount > 0 && (
                  <span className="font-bold text-egg">
                    {formatCount(own.rottenEggCount)} <span className="emoji">🥚</span>
                  </span>
                )}
                {own.rottenEggCount > 0 && own.medalCount > 0 && <span className="text-haze"> and </span>}
                {own.medalCount > 0 && (
                  <span className="font-bold text-medal">
                    {formatCount(own.medalCount)} <span className="emoji">🏅</span>
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1.5 text-base text-haze">Nothing yet. The crowd is watching.</p>
            )}
          </div>

          <div className="text-right">
            <p className="label-caps text-haze-dim">Your opinion</p>
            <p
              className={`mt-1.5 inline-flex items-center gap-1.5 text-base font-semibold ${
                own.stance === 'negative' ? 'text-egg' : own.stance === 'positive' ? 'text-medal' : 'text-haze'
              }`}
            >
              <span className="emoji" aria-hidden="true">
                {own.stance === 'negative' ? '🥚' : own.stance === 'positive' ? '🏅' : '·'}
              </span>
              {stanceLabel}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-haze-dim">
          Reactions measure how strongly you felt. Your opinion counts you once — switching sides moves you across, it
          never counts you twice.
        </p>
      </div>

      <div className="glass rounded-[var(--radius-card)] p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="label-caps text-haze-dim">Opinion balance</p>
          <p className="text-xs text-haze-dim">
            {formatCount(state.totals.uniqueParticipantTotal)} people took part
          </p>
        </div>
        <SentimentBar totals={state.totals} />
      </div>

      {activity.length > 0 && (
        <div className="glass rounded-[var(--radius-card)] p-5">
          <p className="label-caps mb-3 text-haze-dim">Recent reaction activity</p>
          <ul className="space-y-2">
            {activity.map((item, index) => (
              <li key={`${item.createdAt}-${index}`} className="flex items-center gap-3 text-sm">
                <span className="emoji text-base" aria-hidden="true">
                  {item.reactionType === 'rotten_egg' ? '🥚' : '🏅'}
                </span>
                <span
                  className={`font-semibold tabular ${item.reactionType === 'rotten_egg' ? 'text-egg' : 'text-medal'}`}
                >
                  +{formatCount(item.quantity)}
                </span>
                <span className="text-haze">
                  {item.reactionType === 'rotten_egg' ? 'Rotten Eggs' : 'Medals'} from one person
                </span>
                <RelativeTime iso={item.createdAt} className="ml-auto text-xs text-haze-dim" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
