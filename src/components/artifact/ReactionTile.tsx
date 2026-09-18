'use client';

import { useRef } from 'react';
import { ParticleLayer } from '@/components/reactions/ParticleLayer';
import { useHoldToReact } from '@/components/reactions/useHoldToReact';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';
import { ReactionMark } from '@/components/ui/icons';

/**
 * A reaction control sized for a card rather than a page: the tone fills the
 * whole tile, the total sits on it at display scale, and the button is a solid
 * ink bar across the bottom.
 *
 * The compact sibling of the hero slab — same behaviour, same hold-to-repeat,
 * a third of the height.
 */

const COPY = {
  rotten_egg: { label: 'Rotten eggs', action: 'Egg it', closed: 'Closed to you 🔒' },
  medal: { label: 'Medals', action: 'Medal it', closed: 'Closed to you 🔒' },
} as const satisfies Record<ReactionType, Record<string, string>>;

export function ReactionTile({ card, reactionType }: { card: ArtifactCard; reactionType: ReactionType }) {
  const numberRef = useRef<HTMLDivElement | null>(null);
  const isEgg = reactionType === 'rotten_egg';
  const copy = COPY[reactionType];

  const { total, locked, buttonProps, particleRef, srStatus, announcement } = useHoldToReact({
    artifactType: card.type,
    artifactId: card.id,
    artifactTitle: card.title,
    reactionType,
    totals: card.totals,
    contribution: card.contribution,
    punchRef: numberRef,
  });

  return (
    <div className={`border-2 border-ink p-3.5 ${isEgg ? 'bg-egg' : 'bg-medal'} text-ink`}>
      <ParticleLayer handleRef={particleRef} />

      <div className="flex items-start justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase leading-none tracking-[0.12em] text-[rgb(23_20_15_/_0.7)]">
          {copy.label}
        </span>
        <ReactionMark reactionType={reactionType} size={17} className={locked ? 'opacity-45' : ''} />
      </div>

      <div ref={numberRef} className="numeric-lg mt-2 origin-left text-[clamp(28px,3vw,40px)] text-ink">
        {formatCount(total)}
      </div>

      <button
        type="button"
        {...buttonProps}
        aria-disabled={locked}
        aria-label={srStatus}
        className={`btn mark-inherit mt-3 w-full justify-start px-3 py-2.5 text-[13px] font-extrabold ${
          locked
            ? 'cursor-not-allowed border border-dashed border-[rgb(23_20_15_/_0.5)] text-[rgb(23_20_15_/_0.6)]'
            : 'bg-ink text-paper'
        }`}
      >
        {locked ? (
          copy.closed
        ) : (
          <>
            {copy.action}
            <ReactionMark reactionType={reactionType} size={15} />
          </>
        )}
      </button>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
