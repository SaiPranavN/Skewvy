'use client';

import { useRef } from 'react';
import { ParticleLayer } from '@/components/reactions/ParticleLayer';
import { useHoldToReact } from '@/components/reactions/useHoldToReact';
import { Overlay } from '@/components/ui/Overlay';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';

/**
 * A reaction panel: the total at display scale, the emoji, and one wide button
 * under it.
 *
 * The egg is the loud one — three-pixel edge, hard orange offset shadow, the
 * largest numeral on the page. The medal answers it a size down and without the
 * shadow. When a side is closed to the viewer the panel loses its weight
 * entirely: a hairline edge, a dimmed icon and a dashed, unpressable button.
 */

const COPY = {
  rotten_egg: {
    label: 'Rotten eggs',
    emoji: '🥚',
    first: 'Send an egg 🥚',
    again: 'Another one 🥚',
    closed: 'Closed to you 🔒',
    hint: 'Hold it down for rapid fire.',
    lockedNote: 'One opinion per person. You went appreciative on this item, so the egg side is closed to you here.',
    nudgeTitle: 'The egg side is closed to you.',
    nudgeBody: 'You already recorded one appreciative opinion on this item, and that is final. Medals stay unlimited.',
  },
  medal: {
    label: 'Medals',
    emoji: '🏅',
    first: 'Give a medal 🏅',
    again: 'More credit 🏅',
    closed: 'Closed to you 🔒',
    hint: 'Credit where credit is due. Hold it down if you really mean it.',
    lockedNote: 'One opinion per person. You went critical on this item, so the medal side is closed to you here.',
    nudgeTitle: 'The medal side is closed to you.',
    nudgeBody: 'You already recorded one critical opinion on this item, and that is final. Eggs stay unlimited.',
  },
} as const satisfies Record<ReactionType, Record<string, string>>;

export function ReactionSlab({ card, reactionType }: { card: ArtifactCard; reactionType: ReactionType }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const numberRef = useRef<HTMLDivElement | null>(null);

  const { total, own, locked, isAuthenticated, nudged, buttonProps, particleRef, announcement, srStatus, state } =
    useHoldToReact({
      artifactType: card.type,
      artifactId: card.id,
      artifactTitle: card.title,
      reactionType,
      totals: card.totals,
      contribution: card.contribution,
      punchRef: numberRef,
      shakeRef: panelRef,
    });

  const isEgg = reactionType === 'rotten_egg';
  const copy = COPY[reactionType];

  const panelClass = locked
    ? 'on-paper bg-paper text-ink border border-[var(--rule-default)]'
    : isEgg
      ? 'slab'
      : 'on-paper bg-paper text-ink border-2 border-ink';

  return (
    <div ref={panelRef} className={`${panelClass} p-[clamp(18px,1.9vw,26px)]`}>
      <ParticleLayer handleRef={particleRef} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow-ink">{copy.label}</div>
          <div
            ref={numberRef}
            className="numeric-lg mt-2 origin-left"
            style={{
              fontSize: isEgg ? 'clamp(58px,7.4vw,104px)' : 'clamp(40px,4.8vw,66px)',
              lineHeight: isEgg ? 0.86 : 0.88,
              letterSpacing: isEgg ? '-0.05em' : '-0.045em',
              color: isEgg ? 'var(--color-egg-deep)' : 'var(--color-medal-deep)',
            }}
          >
            {formatCount(total)}
          </div>
        </div>
        <span
          className="emoji flex-none"
          aria-hidden="true"
          style={{
            fontSize: isEgg ? 'clamp(28px,3.2vw,42px)' : 'clamp(24px,2.6vw,34px)',
            opacity: locked ? 0.45 : 1,
          }}
        >
          {copy.emoji}
        </span>
      </div>

      <button
        type="button"
        {...buttonProps}
        aria-disabled={locked}
        aria-describedby={`${card.id}-${reactionType}-status`}
        className={`btn mt-[18px] ${locked ? 'btn-locked' : isEgg ? 'btn-egg' : 'btn-medal'}`}
      >
        {locked ? copy.closed : own > 0 ? copy.again : copy.first}
      </button>

      {locked ? (
        <p className="mt-3 max-w-[42ch] text-xs font-medium leading-[1.45] text-[rgb(23_20_15_/_0.62)]">
          {copy.lockedNote}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap justify-between gap-2.5 text-xs font-medium leading-[1.4] text-[rgb(23_20_15_/_0.6)]">
          <span>{isAuthenticated ? copy.hint : 'Sign in to record a reaction.'}</span>
          {own > 0 && <span className="numeric font-bold">Yours: {formatCount(own)}</span>}
        </div>
      )}

      {state.syncState === 'retrying' && (
        <p className="mt-2 text-xs text-[rgb(23_20_15_/_0.62)]" role="status">
          Reconnecting — your reactions are saved.
        </p>
      )}
      {state.syncState === 'offline' && (
        <p className="mt-2 text-xs font-bold text-[rgb(23_20_15_/_0.62)]" role="status">
          Offline. Your reactions will sync when the connection returns.
        </p>
      )}

      <span id={`${card.id}-${reactionType}-status`} className="sr-only">
        {srStatus}
      </span>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {nudged && <LockedNudge title={copy.nudgeTitle} body={copy.nudgeBody} />}
    </div>
  );
}

/** Says why the tap did nothing, clear of the sticky tray at the bottom edge. */
function LockedNudge({ title, body }: { title: string; body: string }) {
  return (
    <Overlay>
      <div
        role="status"
        className="pointer-events-none fixed left-1/2 z-[90] max-w-[min(92vw,440px)] -translate-x-1/2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 86px)' }}
      >
        <div className="pop-in border-2 border-ink bg-medal px-[18px] py-[15px] text-ink">
          <div className="text-[16.5px] font-extrabold leading-[1.2]">{title}</div>
          <p className="mt-[7px] text-[13px] font-medium leading-[1.45] text-[rgb(23_20_15_/_0.78)]">{body}</p>
        </div>
      </div>
    </Overlay>
  );
}
