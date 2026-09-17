'use client';

import { useEffect, useRef, useState } from 'react';
import { ParticleLayer } from '@/components/reactions/ParticleLayer';
import { useHoldToReact } from '@/components/reactions/useHoldToReact';
import { Overlay } from '@/components/ui/Overlay';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';

/**
 * The reaction tray: both totals and both buttons in one bar, centred on the
 * bottom edge. It rises into view once the hero panels have left the top of
 * the viewport and drops away when they come back — at every width, not only
 * on a phone, because the article runs long on a desktop too.
 *
 * Position is read directly on scroll rather than inferred from an
 * IntersectionObserver entry: a long jump — an anchor link, a restored scroll
 * position — can skip the observer's thresholds entirely.
 */
export function StickyReactionTray({ card, watchTargetId }: { card: ArtifactCard; watchTargetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const target = document.getElementById(watchTargetId);
      if (!target) return;
      setVisible(target.getBoundingClientRect().bottom <= 8);
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

  if (!visible) return null;

  return (
    <Overlay>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div
          className="tray-in pointer-events-auto flex max-w-full items-stretch border-2 border-ink on-paper bg-paper text-ink"
          style={{ boxShadow: 'var(--shadow-overlay)' }}
        >
          <TrayHalf card={card} reactionType="rotten_egg" />
          <TrayHalf card={card} reactionType="medal" />
        </div>
      </div>
    </Overlay>
  );
}

const TRAY_COPY = {
  rotten_egg: { emoji: '🥚', action: 'Egg it', locked: 'Locked' },
  medal: { emoji: '🏅', action: 'Medal it', locked: 'Locked' },
} as const satisfies Record<ReactionType, Record<string, string>>;

function TrayHalf({ card, reactionType }: { card: ArtifactCard; reactionType: ReactionType }) {
  const numberRef = useRef<HTMLSpanElement | null>(null);
  const isEgg = reactionType === 'rotten_egg';
  const copy = TRAY_COPY[reactionType];

  const { total, locked, buttonProps, particleRef, srStatus } = useHoldToReact({
    artifactType: card.type,
    artifactId: card.id,
    artifactTitle: card.title,
    reactionType,
    totals: card.totals,
    contribution: card.contribution,
    punchRef: numberRef,
  });

  return (
    <>
      <ParticleLayer handleRef={particleRef} />

      <div className="flex items-center gap-2 border-r border-[var(--rule-default)] px-3.5 py-2.5">
        <span
          className="emoji flex-none"
          aria-hidden="true"
          style={{ fontSize: isEgg ? 19 : 17, opacity: isEgg ? 1 : 0.7 }}
        >
          {copy.emoji}
        </span>
        <span
          ref={numberRef}
          className="numeric font-extrabold"
          style={{
            fontSize: isEgg ? 'clamp(18px,2.4vw,24px)' : 'clamp(16px,2vw,21px)',
            lineHeight: 1,
            color: isEgg ? 'var(--color-egg-deep)' : '#8a6500',
          }}
        >
          {formatCount(total)}
        </span>
      </div>

      <button
        type="button"
        {...buttonProps}
        aria-disabled={locked}
        aria-label={srStatus}
        className={`btn min-h-[52px] flex-none border-0 border-r border-[var(--rule-default)] px-[18px] py-2.5 text-[clamp(13px,1.3vw,15px)] font-extrabold last:border-r-0 ${
          locked
            ? 'cursor-not-allowed bg-[rgb(23_20_15_/_0.08)] text-[rgb(23_20_15_/_0.62)]'
            : isEgg
              ? 'bg-egg text-ink'
              : 'bg-medal text-ink'
        }`}
      >
        {locked ? copy.locked : copy.action}
      </button>
    </>
  );
}
