'use client';

import { useEffect, useRef, useState } from 'react';
import { ParticleLayer } from '@/components/reactions/ParticleLayer';
import { useArtifact } from '@/components/reactions/useArtifact';
import { useHoldToReact } from '@/components/reactions/useHoldToReact';
import { Overlay } from '@/components/ui/Overlay';
import { formatCount } from '@/lib/domain/format';
import { contributorPhrase } from '@/lib/domain/copy';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';
import { ReactionMark } from '@/components/ui/icons';

/**
 * The reaction tray: one control, for the side this person actually took.
 *
 * It appears only once a position has been picked, because there is nothing
 * useful it could offer before that — an undecided person needs the flow, not a
 * shortcut past it. Offering both sides down here would also quietly undo the
 * rule the flow exists to teach.
 *
 * It rises into view once the flow has left the top of the viewport and drops
 * away when it comes back — at every width, because the page runs long on a
 * desktop too. Position is read directly on scroll rather than inferred from an
 * IntersectionObserver entry: a long jump — an anchor link, a restored scroll
 * position — can skip the observer's thresholds entirely.
 */
export function StickyReactionTray({ card, watchTargetId }: { card: ArtifactCard; watchTargetId: string }) {
  const [scrolledPast, setScrolledPast] = useState(false);
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });

  const side = state.contribution.stance ?? state.selectedStance;

  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const target = document.getElementById(watchTargetId);
      if (!target) return;
      setScrolledPast(target.getBoundingClientRect().bottom <= 8);
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [watchTargetId]);

  if (!scrolledPast || !side) return null;

  return (
    <Overlay>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div
          className="tray-in on-paper pointer-events-auto flex max-w-full items-stretch border-2 border-ink bg-paper text-ink"
          style={{ boxShadow: 'var(--shadow-overlay)' }}
        >
          <Tray card={card} reactionType={side === 'negative' ? 'rotten_egg' : 'medal'} />
        </div>
      </div>
    </Overlay>
  );
}

const TRAY_COPY = {
  rotten_egg: { action: 'Egg it' },
  medal: { action: 'Medal it' },
} as const satisfies Record<ReactionType, { action: string }>;

function Tray({ card, reactionType }: { card: ArtifactCard; reactionType: ReactionType }) {
  const numberRef = useRef<HTMLSpanElement | null>(null);
  const isEgg = reactionType === 'rotten_egg';

  const { total, own, buttonProps, particleRef, srStatus, state } = useHoldToReact({
    artifactType: card.type,
    artifactId: card.id,
    artifactTitle: card.title,
    reactionType,
    totals: card.totals,
    contribution: card.contribution,
    punchRef: numberRef,
  });

  const contributors = isEgg
    ? state.totals.rottenEggContributorTotal
    : state.totals.medalContributorTotal;

  return (
    <>
      <ParticleLayer handleRef={particleRef} />

      {/*
       * Even here, at the smallest the numbers ever get, the tap total does not
       * appear without the head count beside it.
       */}
      <div className="flex min-w-0 items-center gap-2.5 border-r border-[var(--rule-default)] px-3.5 py-2.5">
        <ReactionMark reactionType={reactionType} size={19} className="flex-none" />
        <span className="min-w-0">
          <span
            ref={numberRef}
            className="numeric block font-extrabold"
            style={{
              fontSize: 'clamp(18px,2.4vw,24px)',
              lineHeight: 1,
              color: isEgg ? 'var(--color-egg-deep)' : '#8a6500',
            }}
          >
            {formatCount(total)}
          </span>
          <span className="mt-1 block truncate text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em] text-[rgb(23_20_15_/_0.62)]">
            {contributorPhrase(reactionType, contributors)}
            {own > 0 && ` · ${formatCount(own)} yours`}
          </span>
        </span>
      </div>

      <button
        type="button"
        {...buttonProps}
        aria-label={srStatus}
        className={`btn mark-inherit min-h-[52px] flex-none border-0 px-[18px] py-2.5 text-[clamp(13px,1.3vw,15px)] font-extrabold ${
          isEgg ? 'bg-egg text-ink' : 'bg-medal text-ink'
        }`}
      >
        {TRAY_COPY[reactionType].action}
      </button>
    </>
  );
}
