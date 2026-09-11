'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ParticleLayer, type ParticleHandle } from './ParticleLayer';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { reactionStore } from '@/lib/client/reaction-store';
import { useArtifact } from './useArtifact';
import { useReactionContext } from './ReactionProvider';
import { formatCount } from '@/lib/domain/format';
import { EGG_ACTION, MEDAL_ACTION } from '@/lib/domain/copy';
import type { ArtifactTotals, ArtifactType, ReactionType, UserContribution } from '@/lib/domain/types';

/**
 * The reaction counter — a serious interactive number, not a coloured tile.
 *
 * The total is the visual anchor and reads before the action label. Colour is
 * carried by the numerals and, while pressed, a hairline border and a barely
 * perceptible surface tint. Nothing glows.
 *
 * A tap never waits on the network, and a signed-out tap records nothing at all:
 * it opens the sign-in sheet instead, so the public number only ever moves for a
 * reaction that will be saved.
 */

const HOLD_START_DELAY_MS = 320;
/** Press-and-hold produces a controlled stream, not an uncapped spray. */
const HOLD_INTERVAL_MS = 90;

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
  const state = useArtifact(artifactType, artifactId, { totals, contribution });
  const { isAuthenticated } = useReactionContext();

  const particleRef = useRef<ParticleHandle | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pressed, setPressed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const labelId = useId();

  const isEgg = reactionType === 'rotten_egg';
  const emoji = isEgg ? '🥚' : '🏅';
  const actionLabel = isEgg ? EGG_ACTION : MEDAL_ACTION;
  const total = isEgg ? state.totals.rottenEggTotal : state.totals.medalTotal;
  const own = isEgg ? state.contribution.rottenEggCount : state.contribution.medalCount;

  /** At most one announcement every 1.5s, so a burst cannot flood a reader. */
  const scheduleAnnouncement = useCallback(
    (nextTotal: number) => {
      if (announceTimerRef.current) return;
      announceTimerRef.current = setTimeout(() => {
        announceTimerRef.current = null;
        setAnnouncement(`${formatCount(nextTotal)} ${isEgg ? 'Rotten Eggs' : 'Medals'} for ${artifactTitle}.`);
      }, 1500);
    },
    [artifactTitle, isEgg],
  );

  const fire = useCallback(
    (originX?: number) => {
      const accepted = reactionStore.react(artifactType, artifactId, reactionType, 1);
      if (!accepted) return false;

      particleRef.current?.spawn(reactionType, originX);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(isEgg ? 10 : [6, 14, 6]);
        } catch {
          // Haptics are a nicety, never a requirement.
        }
      }

      const current = reactionStore.get(artifactType, artifactId);
      if (current) scheduleAnnouncement(isEgg ? current.totals.rottenEggTotal : current.totals.medalTotal);
      return true;
    },
    [artifactId, artifactType, isEgg, reactionType, scheduleAnnouncement],
  );

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
    setPressed(false);
  }, []);

  const startHold = useCallback(
    (originX?: number) => {
      holdTimerRef.current = setTimeout(() => {
        holdIntervalRef.current = setInterval(() => {
          // A session that lapses mid-hold stops the stream rather than
          // spinning against a control that can no longer record anything.
          if (!fire(originX)) stopHold();
        }, HOLD_INTERVAL_MS);
      }, HOLD_START_DELAY_MS);
    },
    [fire, stopHold],
  );

  useEffect(() => stopHold, [stopHold]);
  useEffect(
    () => () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    },
    [],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const rect = event.currentTarget.getBoundingClientRect();
    const originX = Math.max(12, Math.min(rect.width - 12, event.clientX - rect.left));

    setPressed(true);
    if (fire(originX)) startHold(originX);
    else setPressed(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();

    // The operating system's key repeat is ignored: holding the key starts the
    // same controlled stream that holding a pointer does.
    if (event.repeat) return;

    setPressed(true);
    if (fire()) startHold();
    else setPressed(false);
  };

  const tone = isEgg
    ? { control: 'reaction-control-egg', number: 'text-egg', own: 'text-egg' }
    : { control: 'reaction-control-medal', number: 'text-medal', own: 'text-medal' };

  const layout = {
    sm: { pad: 'px-3 py-2.5', gap: 'gap-2', number: 'text-base', emoji: 'text-sm', label: 'text-[0.6875rem]' },
    md: { pad: 'px-4 py-3', gap: 'gap-2.5', number: 'text-xl', emoji: 'text-base', label: 'text-xs' },
    lg: { pad: 'px-4 py-5', gap: 'gap-3', number: 'text-3xl sm:text-4xl', emoji: 'text-xl', label: 'text-xs' },
  }[size];

  return (
    <div className="relative">
      <ParticleLayer handleRef={particleRef} />

      <button
        type="button"
        data-pressed={pressed}
        aria-labelledby={labelId}
        aria-describedby={`${labelId}-status`}
        onPointerDown={handlePointerDown}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onKeyDown={handleKeyDown}
        onKeyUp={stopHold}
        onBlur={stopHold}
        onContextMenu={(event) => event.preventDefault()}
        className={`reaction-control ${tone.control} flex w-full touch-manipulation select-none flex-col items-start ${layout.gap} ${layout.pad} rounded-[var(--radius-control)] text-left`}
        style={{ minHeight: size === 'lg' ? 108 : 44 }}
      >
        <span className="flex items-baseline gap-2">
          <span className={`emoji ${layout.emoji}`} aria-hidden="true">
            {emoji}
          </span>
          <RollingNumber value={total} className={`reaction-total font-semibold ${tone.number} ${layout.number}`} />
        </span>

        <span className="flex w-full items-baseline justify-between gap-2">
          <span id={labelId} className={`${layout.label} text-secondary`}>
            {actionLabel}
          </span>
          {own > 0 && (
            <span className={`${layout.label} numeric ${tone.own}`}>
              You: {formatCount(own)}
            </span>
          )}
        </span>
      </button>

      <span id={`${labelId}-status`} className="sr-only">
        {formatCount(total)} {isEgg ? 'Rotten Eggs' : 'Medals'} recorded for {artifactTitle}. You have sent{' '}
        {formatCount(own)}.{' '}
        {isAuthenticated ? 'Press and hold to send more.' : 'Sign in to record a reaction.'}
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
