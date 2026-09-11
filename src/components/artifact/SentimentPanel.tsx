'use client';

import { ReactionControl } from '@/components/reactions/ReactionControl';
import { CrowdSignal } from '@/components/reactions/CrowdSignal';
import { OpinionSummary } from '@/components/ui/OpinionSummary';
import { SentimentMarker } from '@/components/ui/SentimentMarker';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { useReactionContext } from '@/components/reactions/ReactionProvider';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';

export interface RecentActivityItem {
  reactionType: ReactionType;
  quantity: number;
  createdAt: string;
}

/**
 * Public reaction, kept visually separate from the factual context beside it.
 *
 * Reaction totals lead. The viewer's own contribution and the public opinion
 * follow at body scale, so the two measurements never compete for attention.
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
  const { isAuthenticated, requestSignIn } = useReactionContext();
  const own = state.contribution;
  const hasContributed = own.rottenEggCount > 0 || own.medalCount > 0;

  const stanceLabel =
    own.stance === 'negative' ? 'Critical' : own.stance === 'positive' ? 'Appreciative' : 'Not recorded';

  return (
    <section aria-labelledby="reaction-heading" className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="reaction-heading" className="text-lg font-medium tracking-[-0.01em] text-primary">
          Public reaction
        </h2>
        <CrowdSignal
          artifactType={card.type}
          artifactId={card.id}
          totals={card.totals}
          contribution={card.contribution}
        />
      </div>

      <div id={anchorId} className="grid grid-cols-2 gap-3">
        <ReactionControl
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="rotten_egg"
          totals={card.totals}
          contribution={card.contribution}
        />
        <ReactionControl
          artifactType={card.type}
          artifactId={card.id}
          artifactTitle={card.title}
          reactionType="medal"
          totals={card.totals}
          contribution={card.contribution}
        />
      </div>

      {!isAuthenticated && (
        <p className="text-sm text-tertiary">
          <button
            type="button"
            onClick={requestSignIn}
            className="text-primary underline underline-offset-2 transition-opacity duration-150 hover:opacity-80"
          >
            Sign in
          </button>{' '}
          to record a reaction and be counted in the public opinion.
        </p>
      )}

      <div className="panel p-5">
        <OpinionSummary totals={state.totals} />
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-medium text-primary">Your contribution</h3>

        <dl className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-secondary">Rotten Eggs</dt>
            <dd className="numeric font-medium text-egg">
              {formatCount(own.rottenEggCount)} <span className="emoji text-xs">🥚</span>
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-secondary">Medals</dt>
            <dd className="numeric font-medium text-medal">
              {formatCount(own.medalCount)} <span className="emoji text-xs">🏅</span>
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-secondary">Your opinion</dt>
            <dd className="font-medium text-primary">{stanceLabel}</dd>
          </div>
        </dl>

        {!hasContributed && isAuthenticated && (
          <p className="mt-3 text-xs text-tertiary">You have not reacted to this yet.</p>
        )}
        {hasContributed && (
          <p className="mt-3 text-xs leading-relaxed text-tertiary">
            Changing sides moves your single opinion across. Reactions you have already sent are not withdrawn.
          </p>
        )}
      </div>

      {activity.length > 0 && (
        <div className="panel p-5">
          <h3 className="text-sm font-medium text-primary">Recent activity</h3>
          <ul className="mt-3 space-y-2.5">
            {activity.map((item, index) => (
              <li key={`${item.createdAt}-${index}`} className="flex items-baseline gap-3 text-sm">
                <span className="emoji text-xs" aria-hidden="true">
                  {item.reactionType === 'rotten_egg' ? '🥚' : '🏅'}
                </span>
                <span className={`numeric font-medium ${item.reactionType === 'rotten_egg' ? 'text-egg' : 'text-medal'}`}>
                  +{formatCount(item.quantity)}
                </span>
                <span className="text-secondary">
                  {item.reactionType === 'rotten_egg' ? 'Rotten Eggs' : 'Medals'} from one person
                </span>
                <RelativeTime iso={item.createdAt} className="ml-auto shrink-0 text-xs text-tertiary" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <SentimentMarker totals={state.totals} />
    </section>
  );
}
