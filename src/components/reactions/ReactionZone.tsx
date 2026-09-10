'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ParticleLayer, type ParticleHandle } from './ParticleLayer';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { reactionStore } from '@/lib/client/reaction-store';
import { useArtifact } from './useArtifact';
import { useReactionContext } from './ReactionProvider';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactTotals, ArtifactType, ReactionType, UserContribution } from '@/lib/domain/types';

/**
 * The main interaction: a large tap target that sends one Reaction per press,
 * repeats while held, and works from the keyboard.
 *
 * Never blocks on the network — the counter moves in the same frame as the tap.
 */

const HOLD_START_DELAY_MS = 320;
/** Press-and-hold produces a controlled stream rather than an uncapped spray. */
const HOLD_INTERVAL_MS = 90;

export interface ReactionZoneProps {
  artifactType: ArtifactType;
  artifactId: string;
  artifactTitle: string;
  reactionType: ReactionType;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
  size?: 'compact' | 'large';
  microcopy?: string;
}

export function ReactionZone({
  artifactType,
  artifactId,
  artifactTitle,
  reactionType,
  totals,
  contribution,
  size = 'large',
  microcopy,
}: ReactionZoneProps) {
  const state = useArtifact(artifactType, artifactId, { totals, contribution });
  const { isAuthenticated } = useReactionContext();
  const particleRef = useRef<ParticleHandle | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const labelId = useId();

  const isEgg = reactionType === 'rotten_egg';
  const emoji = isEgg ? '🥚' : '🏅';
  const actionLabel = isEgg ? 'Send Rotten Eggs' : 'Give Medals';
  const total = isEgg ? state.totals.rottenEggTotal : state.totals.medalTotal;
  const own = isEgg ? state.contribution.rottenEggCount : state.contribution.medalCount;

  /** Announce at most once every 1.5s, so rapid tapping does not flood output. */
  const scheduleAnnouncement = useCallback(
    (nextTotal: number) => {
      if (announceTimerRef.current) return;
      announceTimerRef.current = setTimeout(() => {
        announceTimerRef.current = null;
        setAnnouncement(
          `${formatCount(nextTotal)} ${isEgg ? 'Rotten Eggs' : 'Medals'} for ${artifactTitle}.`,
        );
      }, 1500);
    },
    [artifactTitle, isEgg],
  );

  const fire = useCallback(
    (originX?: number) => {
      const accepted = reactionStore.react(artifactType, artifactId, reactionType, 1);
      particleRef.current?.spawn(reactionType, originX);

      // Short, distinct haptic pulse where the device supports it.
      if (accepted && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(isEgg ? 12 : [8, 18, 8]);
        } catch {
          // Vibration is a nicety, never a requirement.
        }
      }

      const current = reactionStore.get(artifactType, artifactId);
      if (current) scheduleAnnouncement(isEgg ? current.totals.rottenEggTotal : current.totals.medalTotal);
    },
    [artifactId, artifactType, isEgg, reactionType, scheduleAnnouncement],
  );

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdTimerRef.current = null;
    holdIntervalRef.current = null;
  }, []);

  const startHold = useCallback(
    (originX?: number) => {
      stopHold();
      holdTimerRef.current = setTimeout(() => {
        holdIntervalRef.current = setInterval(() => fire(originX), HOLD_INTERVAL_MS);
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

  const relativeX = (event: { clientX: number; currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(12, Math.min(rect.width - 12, event.clientX - rect.left));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const originX = relativeX({ clientX: event.clientX, currentTarget: event.currentTarget });
    fire(originX);
    startHold(originX);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();

    // The operating system's own key repeat is ignored: holding the key starts
    // the same controlled stream that holding a pointer does, so the rate is
    // identical however the person is tapping.
    if (event.repeat) return;

    fire();
    startHold();
  };

  const palette = isEgg
    ? {
        ring: 'ring-egg/35',
        glow: 'from-egg/22 via-egg-deep/14 to-transparent',
        text: 'text-egg',
        border: 'border-egg/28 hover:border-egg/55',
        chip: 'bg-egg/14 text-egg',
      }
    : {
        ring: 'ring-medal/35',
        glow: 'from-medal/22 via-medal-deep/14 to-transparent',
        text: 'text-medal',
        border: 'border-medal/28 hover:border-medal/55',
        chip: 'bg-medal/14 text-medal',
      };

  const large = size === 'large';

  return (
    <div className="relative">
      <ParticleLayer handleRef={particleRef} />

      <button
        type="button"
        aria-labelledby={labelId}
        aria-describedby={`${labelId}-total`}
        onPointerDown={handlePointerDown}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onKeyDown={handleKeyDown}
        onKeyUp={stopHold}
        onContextMenu={(event) => event.preventDefault()}
        className={`reaction-zone group relative flex w-full touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-3xl border ${palette.border} glass px-4 text-center transition-[transform,border-color] duration-150 active:scale-[0.985] ${
          large ? 'gap-1.5 py-6 sm:py-8' : 'gap-1 py-3.5'
        }`}
        style={{ minHeight: large ? 148 : 76 }}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${palette.glow} opacity-70 transition-opacity duration-200 group-hover:opacity-100 group-active:opacity-100`}
        />

        <span className="relative flex items-center gap-2">
          <span className={`emoji ${large ? 'text-3xl sm:text-4xl' : 'text-xl'}`} aria-hidden="true">
            {emoji}
          </span>
          <RollingNumber
            value={total}
            className={`${palette.text} font-bold ${large ? 'text-4xl sm:text-5xl' : 'text-xl'}`}
          />
        </span>

        <span
          id={labelId}
          className={`relative label-caps whitespace-nowrap text-chalk-dim ${
            large ? '' : 'text-[0.5625rem] tracking-[0.12em]'
          }`}
        >
          {actionLabel}
        </span>

        {large && (
          <span className="relative mt-1 text-[0.8125rem] text-haze">
            {microcopy ?? (isEgg ? 'Add to the pile.' : 'Reward the rare W.')}
          </span>
        )}

        {own > 0 && (
          <span className={`relative mt-1 rounded-full px-2.5 py-1 text-xs font-semibold ${palette.chip}`}>
            You sent {formatCount(own)} {emoji}
          </span>
        )}

        {!isAuthenticated && large && (
          <span className="relative mt-1 text-[0.6875rem] text-haze-dim">
            Try it — we&apos;ll keep your taps and add them when you sign in.
          </span>
        )}
      </button>

      <span id={`${labelId}-total`} className="sr-only">
        {formatCount(total)} {isEgg ? 'Rotten Eggs' : 'Medals'} sent so far for {artifactTitle}. You have sent{' '}
        {formatCount(own)}. Press and hold to send more.
      </span>

      {state.syncState === 'retrying' && (
        <p className="mt-2 text-center text-xs text-haze" role="status">
          Reconnecting — your taps are saved.
        </p>
      )}
      {state.syncState === 'offline' && (
        <p className="mt-2 text-center text-xs text-egg-acid" role="status">
          Offline. We&apos;ll sync your taps when the connection returns.
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
