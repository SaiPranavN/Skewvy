'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ParticleHandle } from './ParticleLayer';
import { reactionStore } from '@/lib/client/reaction-store';
import { useArtifact } from './useArtifact';
import { useReactionContext } from './ReactionProvider';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactTotals, ArtifactType, ReactionType, UserContribution } from '@/lib/domain/types';

/**
 * One reaction button's behaviour, shared by every surface that fires one —
 * the hero slab, the sticky tray, the card controls.
 *
 * Holding produces an accelerating stream rather than a fixed drip: the first
 * repeat lands after a beat, then each interval shortens until it floors out.
 * "Hold it down for rapid fire" has to actually feel like rapid fire.
 *
 * A tap never waits on the network, and a signed-out tap records nothing at
 * all: it opens the sign-in sheet instead, so the public number only ever moves
 * for a reaction that will be saved.
 */

const HOLD_START_DELAY_MS = 260;
const HOLD_DECAY = 0.78;
const HOLD_MIN_INTERVAL_MS = 48;

export interface HoldToReactOptions {
  artifactType: ArtifactType;
  artifactId: string;
  artifactTitle: string;
  reactionType: ReactionType;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
  /** Punched on every accepted tap. */
  punchRef?: RefObject<HTMLElement | null>;
  /** Shaken when this side is closed to the viewer. */
  shakeRef?: RefObject<HTMLElement | null>;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useHoldToReact({
  artifactType,
  artifactId,
  artifactTitle,
  reactionType,
  totals,
  contribution,
  punchRef,
  shakeRef,
}: HoldToReactOptions) {
  const state = useArtifact(artifactType, artifactId, { totals, contribution });
  const { isAuthenticated } = useReactionContext();

  const particleRef = useRef<ParticleHandle | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<DOMRect | null>(null);

  const [pressed, setPressed] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const isEgg = reactionType === 'rotten_egg';
  const total = isEgg ? state.totals.rottenEggTotal : state.totals.medalTotal;
  const own = isEgg ? state.contribution.rottenEggCount : state.contribution.medalCount;

  /*
   * A side, once taken, is final. This control is the other side, so it is
   * marked closed rather than merely refused on tap — the person should be able
   * to see the rule before they run into it.
   */
  const stanceForThis = isEgg ? 'negative' : 'positive';
  const locked = isAuthenticated && state.contribution.stance !== null && state.contribution.stance !== stanceForThis;
  const isChosenSide = state.contribution.stance === stanceForThis;

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

  const punch = useCallback(() => {
    const element = punchRef?.current;
    if (!element || prefersReducedMotion() || typeof element.animate !== 'function') return;
    const tilt = isEgg ? -2 : 2;
    element.animate(
      [
        { transform: 'scale(1) rotate(0deg)' },
        { transform: `scale(1.12) rotate(${tilt}deg)` },
        { transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: 240, easing: 'cubic-bezier(.2,.9,.2,1)' },
    );
  }, [isEgg, punchRef]);

  const fire = useCallback((): boolean => {
    const accepted = reactionStore.react(artifactType, artifactId, reactionType, 1);
    if (!accepted) return false;

    particleRef.current?.spawn(reactionType, originRef.current);
    punch();

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
  }, [artifactId, artifactType, isEgg, punch, reactionType, scheduleAnnouncement]);

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setPressed(false);
  }, []);

  /** Each repeat lands sooner than the last, down to the floor. */
  const startHold = useCallback(() => {
    let delay = HOLD_START_DELAY_MS;
    const step = () => {
      // A session that lapses mid-hold stops the stream rather than spinning
      // against a control that can no longer record anything.
      if (!fire()) {
        stopHold();
        return;
      }
      delay = Math.max(HOLD_MIN_INTERVAL_MS, delay * HOLD_DECAY);
      holdTimerRef.current = setTimeout(step, delay);
    };
    holdTimerRef.current = setTimeout(step, delay);
  }, [fire, stopHold]);

  /** The closed side: shove the panel, say why, and record nothing. */
  const refuse = useCallback(() => {
    const element = shakeRef?.current;
    if (element && !prefersReducedMotion() && typeof element.animate === 'function') {
      element.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-7px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 240, easing: 'ease-out' },
      );
    }
    setNudged(true);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => setNudged(false), 2600);
  }, [shakeRef]);

  const begin = useCallback(
    (origin: DOMRect | null) => {
      if (locked) {
        refuse();
        return;
      }
      originRef.current = origin;
      setPressed(true);
      if (fire()) startHold();
      else setPressed(false);
    },
    [fire, locked, refuse, startHold],
  );

  useEffect(() => stopHold, [stopHold]);
  useEffect(
    () => () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    },
    [],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();

    // Capture keeps a hold-and-drag streaming from this control, but it throws
    // if the pointer is already gone. Losing the capture is survivable; losing
    // the tap is not.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Continue without capture.
    }

    begin(event.currentTarget.getBoundingClientRect());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();

    // The operating system's key repeat is ignored: holding the key starts the
    // same accelerating stream that holding a pointer does.
    if (event.repeat) return;

    begin(event.currentTarget.getBoundingClientRect());
  };

  const buttonProps = {
    'data-pressed': pressed,
    onPointerDown,
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onKeyDown,
    onKeyUp: stopHold,
    onBlur: stopHold,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  } as const;

  const srStatus =
    `${formatCount(total)} ${isEgg ? 'Rotten Eggs' : 'Medals'} recorded for ${artifactTitle}. ` +
    `You have sent ${formatCount(own)}. ` +
    (locked
      ? `Unavailable: you already reacted ${state.contribution.stance === 'negative' ? 'critically' : 'appreciatively'} to this, and a side cannot be changed.`
      : isAuthenticated
        ? 'Press and hold to send more.'
        : 'Sign in to record a reaction.');

  return {
    state,
    total,
    own,
    locked,
    isChosenSide,
    isAuthenticated,
    pressed,
    nudged,
    buttonProps,
    particleRef,
    announcement,
    srStatus,
  };
}
