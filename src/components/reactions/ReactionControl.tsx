'use client';

import { useId, useRef } from 'react';
import { ParticleLayer } from './ParticleLayer';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { useHoldToReact } from './useHoldToReact';
import { formatCount } from '@/lib/domain/format';
import { EGG_ACTION, MEDAL_ACTION } from '@/lib/domain/copy';
import type { ArtifactTotals, ArtifactType, ReactionType, UserContribution } from '@/lib/domain/types';

/**
 * The compact reaction counter used on cards and in the entity column — the
 * small sibling of the hero slab.
 *
 * A square of paper with an ink edge: the total leads, the action label reads
 * underneath, and pressing drives the whole control down by three pixels. A
 * side that is closed to the viewer is dimmed and unpressable rather than
 * merely refused on tap, so the rule is visible before it is hit.
 *
 * A tap never waits on the network, and a signed-out tap records nothing at
 * all: it opens the sign-in sheet instead.
 */

export interface ReactionControlProps {
  artifactType: ArtifactType;
  artifactId: string;
  artifactTitle: string;
  reactionType: ReactionType;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
  size?: 'sm' | 'md' | 'lg';
}

export function ReactionControl({
  artifactType,
  artifactId,
  artifactTitle,
  reactionType,
  totals,
  contribution,
  size = 'lg',
}: ReactionControlProps) {
  const labelId = useId();
  const numberRef = useRef<HTMLSpanElement | null>(null);

  const { total, own, locked, isChosenSide, state, buttonProps, particleRef, announcement, srStatus } = useHoldToReact({
    artifactType,
    artifactId,
    artifactTitle,
    reactionType,
    totals,
    contribution,
    punchRef: numberRef,
  });

  const isEgg = reactionType === 'rotten_egg';
  const emoji = isEgg ? '🥚' : '🏅';
  const actionLabel = isEgg ? EGG_ACTION : MEDAL_ACTION;

  const tone = isEgg
    ? {
        control: 'reaction-control-egg',
        number: 'text-[color:var(--color-egg-deep)]',
      }
    : {
        control: 'reaction-control-medal',
        number: 'text-[color:var(--color-medal-deep)]',
      };

  const layout = {
    sm: {
      pad: 'px-3 py-2.5',
      gap: 'gap-1.5',
      number: 'text-base',
      emoji: 'text-sm',
      label: 'text-[0.6875rem]',
      min: 44,
    },
    md: {
      pad: 'px-4 py-3',
      gap: 'gap-2',
      number: 'text-xl',
      emoji: 'text-base',
      label: 'text-xs',
      min: 64,
    },
    lg: {
      pad: 'px-4 py-4',
      gap: 'gap-2.5',
      number: 'text-3xl sm:text-4xl',
      emoji: 'text-xl',
      label: 'text-xs',
      min: 104,
    },
  }[size];

  return (
    <div className="relative">
      <ParticleLayer handleRef={particleRef} />

      <button
        type="button"
        {...buttonProps}
        disabled={locked}
        aria-labelledby={labelId}
        aria-describedby={`${labelId}-status`}
        className={`reaction-control ${tone.control} flex w-full touch-manipulation select-none flex-col items-start text-left ${layout.gap} ${layout.pad} ${
          locked ? 'cursor-not-allowed opacity-45' : ''
        } ${isChosenSide ? 'border-[3px]' : ''}`}
        style={{ minHeight: layout.min }}
      >
        <span className="flex items-baseline gap-2">
          <span className={`emoji ${layout.emoji}`} aria-hidden="true">
            {emoji}
          </span>
          <span ref={numberRef} className="inline-block origin-left">
            <RollingNumber value={total} className={`reaction-total ${tone.number} ${layout.number}`} />
          </span>
        </span>

        {/*
         * The contribution sits under the action rather than opposite it. Side
         * by side, a wrapping label ("Send Rotten / Eggs") left the count
         * stranded against the far edge on a narrow control.
         */}
        <span className="flex w-full flex-col gap-0.5">
          <span
            id={labelId}
            className={`${layout.label} font-bold uppercase leading-none tracking-[0.08em] text-[rgb(23_20_15_/_0.6)]`}
          >
            {actionLabel}
          </span>
          {own > 0 && (
            <span className="numeric text-xs font-bold text-[rgb(23_20_15_/_0.7)]">{formatCount(own)} from you</span>
          )}
        </span>
      </button>

      <span id={`${labelId}-status`} className="sr-only">
        {srStatus}
      </span>

      {state.syncState === 'retrying' && (
        <p className="mt-2 text-xs text-tertiary" role="status">
          Reconnecting — your reactions are saved.
        </p>
      )}
      {state.syncState === 'offline' && (
        <p className="mt-2 text-xs text-warning" role="status">
          Offline. Your reactions will sync when the connection returns.
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
