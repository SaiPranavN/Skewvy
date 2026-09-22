'use client';

import { useEffect, useRef, useState } from 'react';
import { ParticleLayer } from '@/components/reactions/ParticleLayer';
import { useArtifact } from '@/components/reactions/useArtifact';
import { useHoldToReact } from '@/components/reactions/useHoldToReact';
import { useReactionContext } from '@/components/reactions/ReactionProvider';
import { reactionStore } from '@/lib/client/reaction-store';
import { Overlay } from '@/components/ui/Overlay';
import { ReactionMark } from '@/components/ui/icons';
import { formatCount, sharePercent } from '@/lib/domain/format';
import { contributorPhrase } from '@/lib/domain/copy';
import type { ArtifactCard, ReactionType, Stance } from '@/lib/domain/types';

/**
 * The reaction workflow, drawn as the flowchart it actually is.
 *
 * Two independent buttons would say that a Rotten Egg and a Medal are
 * interchangeable choices a person makes over and over. They are not. A person
 * takes **one** position on an artifact, for good, and everything after that is
 * a measure of how strongly they hold it. So the interface asks in that order:
 * pick a side, then say how much.
 *
 *   You ─┬─ Positive → Give Medals
 *        └─ Negative → Send Rotten Eggs
 *
 * Picking a side is free and reversible — it writes nothing and moves no
 * counter — right up until the first reaction lands. That reaction is what
 * commits the opinion, and from then on the other branch is visibly locked
 * rather than hidden: a person should be able to see the rule that is being
 * applied to them.
 */

const BRANCH = {
  positive: {
    stance: 'positive' as Stance,
    reactionType: 'medal' as ReactionType,
    opinionTitle: 'Positive',
    opinionClaim: 'I appreciate this.',
    peopleNoun: 'appreciative',
    step2Title: 'Give Medals',
    step2Support: 'Tap or hold to show how strongly you appreciate this.',
    action: 'Give a Medal',
    actionAgain: 'Give another',
    contributorLabel: 'Given by',
  },
  negative: {
    stance: 'negative' as Stance,
    reactionType: 'rotten_egg' as ReactionType,
    opinionTitle: 'Negative',
    opinionClaim: 'I’m critical of this.',
    peopleNoun: 'critical',
    step2Title: 'Send Rotten Eggs',
    step2Support: 'Tap or hold to show how strongly you disapprove.',
    action: 'Send an Egg',
    actionAgain: 'Send another',
    contributorLabel: 'Sent by',
  },
} as const;

export function OpinionFlow({ card }: { card: ArtifactCard }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const { isAuthenticated } = useReactionContext();

  const committed = state.contribution.stance;
  const selected = committed ?? state.selectedStance;

  /*
   * Commitment is announced once, quietly. Reaction totals are announced by the
   * hold hook on its own throttle, so a burst of taps never floods a reader.
   */
  const [commitmentNote, setCommitmentNote] = useState('');
  const previouslyCommitted = useRef<Stance | null>(committed);

  useEffect(() => {
    if (committed && previouslyCommitted.current !== committed) {
      setCommitmentNote(
        committed === 'negative'
          ? 'Your position is recorded as negative. Rotten Eggs stay open to you; Medals are now locked on this item.'
          : 'Your position is recorded as positive. Medals stay open to you; Rotten Eggs are now locked on this item.',
      );
    }
    previouslyCommitted.current = committed;
  }, [committed]);

  const critical = state.totals.negativeOpinionTotal;
  const appreciative = state.totals.positiveOpinionTotal;
  const people = critical + appreciative;

  return (
    <section
      aria-labelledby={`${card.id}-flow-heading`}
      className="paper p-[clamp(18px,2.4vw,36px)]"
      id="reaction-controls"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-[min(100%,260px)] flex-1">
          <p className="eyebrow-ink">Step 1 — Pick your position</p>
          <h2
            id={`${card.id}-flow-heading`}
            className="display-sm m-0 mt-2.5 text-[clamp(22px,2.4vw,34px)]"
          >
            Where do you stand?
          </h2>
        </div>

        <p className="m-0 max-w-[40ch] flex-[1_1_260px] text-[13px] leading-[1.5] text-[rgb(23_20_15_/_0.66)]">
          Your position counts you once, whatever happens next. Reactions are unlimited and measure how strongly you
          feel — they never make you count twice.
        </p>
      </div>

      {/* ------------------------------- step one ------------------------------ */}

      <div className="mt-[clamp(18px,2.2vw,28px)] flex justify-center">
        <span className="flow-node">You</span>
      </div>

      <Fork live={selected} />

      <div
        role="radiogroup"
        aria-label="Your position on this item"
        className="grid grid-cols-2 gap-[clamp(10px,1.4vw,20px)]"
      >
        <OpinionChoice
          card={card}
          branch="positive"
          count={appreciative}
          people={people}
          selected={selected === 'positive'}
          committed={committed}
        />
        <OpinionChoice
          card={card}
          branch="negative"
          count={critical}
          people={people}
          selected={selected === 'negative'}
          committed={committed}
        />
      </div>

      {/* ------------------------------- step two ------------------------------ */}

      {/* The label belongs above the connectors, so the arrows land on the cards. */}
      <p className="eyebrow-ink mt-[clamp(16px,2vw,24px)] text-center">Step 2 — Express the intensity</p>

      <Drops live={selected} />

      <div className="grid gap-[clamp(10px,1.4vw,20px)] md:grid-cols-2">
        <ReactionBranch card={card} branch="positive" selected={selected} committed={committed} />
        <ReactionBranch card={card} branch="negative" selected={selected} committed={committed} />
      </div>

      <p className="m-0 mt-[clamp(14px,1.8vw,22px)] max-w-[70ch] text-[13px] leading-[1.5] text-[rgb(23_20_15_/_0.62)]">
        {committed
          ? `Your position is recorded and final, so the ${
              committed === 'negative' ? 'Medal' : 'Rotten Egg'
            } branch is closed to you here. You can keep adding ${
              committed === 'negative' ? 'Rotten Eggs' : 'Medals'
            } for as long as you like — they raise the reaction total, never the head count.`
          : selected
            ? 'Nothing is recorded yet. You can still switch sides until your first reaction lands, and that reaction is what fixes your position for good.'
            : isAuthenticated
              ? 'Pick a position to unlock the reaction controls.'
              : 'Pick a position to unlock the reaction controls. You will be asked to sign in before anything is recorded.'}
      </p>

      <p aria-live="polite" className="sr-only">
        {commitmentNote}
      </p>
    </section>
  );
}

/* --------------------------------- step one -------------------------------- */

function OpinionChoice({
  card,
  branch,
  count,
  people,
  selected,
  committed,
}: {
  card: ArtifactCard;
  branch: keyof typeof BRANCH;
  count: number;
  people: number;
  selected: boolean;
  committed: Stance | null;
}) {
  const copy = BRANCH[branch];
  const isCommittedHere = committed === copy.stance;
  const isLockedOut = committed !== null && !isCommittedHere;
  const percent = people > 0 ? sharePercent(count, people) : null;

  return (
    <label
      className={`relative block cursor-pointer border-2 p-[clamp(12px,1.5vw,20px)] transition-colors ${
        isLockedOut ? 'branch-muted cursor-not-allowed border-[var(--rule-default)]' : 'border-ink'
      } ${
        selected
          ? branch === 'positive'
            ? 'branch-live bg-medal'
            : 'branch-live bg-egg'
          : 'bg-[rgb(23_20_15_/_0.03)]'
      } has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-[color:var(--color-indigo)]`}
    >
      <input
        type="radio"
        name={`position-${card.type}-${card.id}`}
        value={copy.stance}
        checked={selected}
        disabled={isLockedOut}
        onChange={() => reactionStore.select(card.type, card.id, copy.stance)}
        className="sr-only"
      />

      <span className="flex flex-wrap items-center gap-2">
        <ReactionMark
          reactionType={copy.reactionType}
          size={18}
          className={`flex-none ${selected ? 'mark-inherit' : ''}`}
        />
        <span className="text-[clamp(15px,1.5vw,20px)] font-extrabold leading-none">{copy.opinionTitle}</span>
        {isCommittedHere && (
          <span className="ml-auto border border-ink bg-paper px-1.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.08em]">
            Your position
          </span>
        )}
        {isLockedOut && (
          <span
            className="ml-auto text-[10px] font-bold uppercase leading-none tracking-[0.08em]"
            aria-hidden="true"
          >
            🔒 Locked
          </span>
        )}
      </span>

      <span className="mt-1.5 block text-[12.5px] font-medium leading-[1.4] text-[rgb(23_20_15_/_0.72)]">
        “{copy.opinionClaim}”
      </span>

      <span
        className="numeric-lg mt-3 block"
        style={{ fontSize: 'clamp(30px,4vw,54px)', lineHeight: 0.86 }}
      >
        {formatCount(count)}
      </span>

      <span className="mt-1.5 block text-[12px] font-bold leading-[1.35]">
        {count === 1 ? `1 ${copy.peopleNoun} person` : `${formatCount(count)} ${copy.peopleNoun} people`}
        {percent !== null && <span className="font-medium text-[rgb(23_20_15_/_0.66)]"> · {percent}%</span>}
      </span>
    </label>
  );
}

/* --------------------------------- step two -------------------------------- */

function ReactionBranch({
  card,
  branch,
  selected,
  committed,
}: {
  card: ArtifactCard;
  branch: keyof typeof BRANCH;
  selected: Stance | null;
  committed: Stance | null;
}) {
  const copy = BRANCH[branch];
  const panelRef = useRef<HTMLDivElement | null>(null);
  const numberRef = useRef<HTMLDivElement | null>(null);

  const isLive = selected === copy.stance;
  const isLockedOut = committed !== null && committed !== copy.stance;

  const { total, own, nudged, buttonProps, particleRef, announcement, srStatus, state } = useHoldToReact({
    artifactType: card.type,
    artifactId: card.id,
    artifactTitle: card.title,
    reactionType: copy.reactionType,
    totals: card.totals,
    contribution: card.contribution,
    punchRef: numberRef,
    shakeRef: panelRef,
    unavailable: !isLive,
  });

  const contributors =
    copy.reactionType === 'rotten_egg'
      ? state.totals.rottenEggContributorTotal
      : state.totals.medalContributorTotal;

  return (
    <div
      ref={panelRef}
      className={`border-2 p-[clamp(14px,1.7vw,22px)] ${
        isLive
          ? 'branch-live border-ink bg-paper'
          : 'branch-muted border-[var(--rule-default)] bg-[rgb(23_20_15_/_0.03)]'
      }`}
    >
      <ParticleLayer handleRef={particleRef} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow-ink">
            Step 2 · {copy.opinionTitle} branch
          </p>
          <h3 className="display-sm m-0 mt-2 text-[clamp(17px,1.8vw,24px)]">{copy.step2Title}</h3>
        </div>
        <ReactionMark reactionType={copy.reactionType} size={26} className="flex-none" />
      </div>

      <p className="m-0 mt-2 max-w-[34ch] text-[12.5px] leading-[1.45] text-[rgb(23_20_15_/_0.66)]">
        {copy.step2Support}
      </p>

      {/*
       * The two figures that must never be confused, one above the other: the
       * tap total at display scale, and the head count behind it in words
       * directly underneath.
       */}
      <div
        ref={numberRef}
        className="numeric-lg mt-[clamp(12px,1.5vw,18px)] origin-left"
        style={{
          fontSize: 'clamp(38px,5vw,66px)',
          lineHeight: 0.86,
          color: copy.reactionType === 'rotten_egg' ? 'var(--color-egg-deep)' : 'var(--color-medal-deep)',
        }}
      >
        {formatCount(total)}
      </div>

      <p className="m-0 mt-2 text-[12.5px] font-bold leading-[1.35]">
        {contributorPhrase(copy.reactionType, contributors)}
        <span className="font-medium text-[rgb(23_20_15_/_0.62)]">
          {' '}
          · {own > 0 ? `${formatCount(own)} from you` : 'none from you yet'}
        </span>
      </p>

      <button
        type="button"
        {...buttonProps}
        aria-disabled={!isLive}
        aria-describedby={`${card.id}-${copy.reactionType}-status`}
        className={`btn mt-[14px] ${
          !isLive ? 'btn-locked' : copy.reactionType === 'rotten_egg' ? 'btn-egg' : 'btn-medal'
        }`}
      >
        {isLockedOut ? (
          'Closed to you 🔒'
        ) : !isLive ? (
          'Pick a position to unlock'
        ) : (
          <>
            {own > 0 ? copy.actionAgain : copy.action}
            <ReactionMark reactionType={copy.reactionType} size={19} />
          </>
        )}
      </button>

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

      <span id={`${card.id}-${copy.reactionType}-status`} className="sr-only">
        {srStatus}
      </span>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {nudged && (
        <Nudge
          title={isLockedOut ? `The ${copy.step2Title} branch is closed to you.` : 'Pick a position first.'}
          body={
            isLockedOut
              ? `You recorded the opposite position on this item, and that is final. ${
                  copy.reactionType === 'rotten_egg' ? 'Medals' : 'Rotten Eggs'
                } stay unlimited.`
              : `Choose ${copy.opinionTitle} above to unlock this. Choosing records nothing — your first reaction does.`
          }
        />
      )}
    </div>
  );
}

/* -------------------------------- connectors ------------------------------- */

/**
 * The split from "You" into the two positions.
 *
 * Positioned against the same two-column grid the cards sit in, so the drops
 * land on their centres — 25% and 75% — at any width.
 */
function Fork({ live }: { live: Stance | null }) {
  const leftLive = live === null || live === 'positive';
  const rightLive = live === null || live === 'negative';

  return (
    <div className="relative h-[34px]" aria-hidden="true">
      <span className="flow-rule left-1/2 top-0 h-[13px] w-[2px] -translate-x-1/2" />
      <span className="flow-rule left-1/4 right-1/4 top-[12px] h-[2px]" />
      <span
        className="flow-rule left-1/4 top-[12px] h-[14px] w-[2px] -translate-x-1/2"
        data-live={leftLive}
      />
      <span className="flow-arrow left-1/4 top-[24px] -translate-x-1/2" data-live={leftLive} />
      <span
        className="flow-rule left-3/4 top-[12px] h-[14px] w-[2px] -translate-x-1/2"
        data-live={rightLive}
      />
      <span className="flow-arrow left-3/4 top-[24px] -translate-x-1/2" data-live={rightLive} />
    </div>
  );
}

/**
 * The two drops from each position into its reaction card.
 *
 * Below the medium breakpoint the reaction cards stack into one column, so the
 * pair of drops collapses into a single centred stem — each card states which
 * branch it belongs to in its own header, which is what carries the pairing
 * once the columns are gone.
 */
function Drops({ live }: { live: Stance | null }) {
  const leftLive = live === null || live === 'positive';
  const rightLive = live === null || live === 'negative';

  return (
    <div className="relative h-[34px]" aria-hidden="true">
      {/* Narrow: one stem. */}
      <span className="flow-rule left-1/2 top-[4px] h-[18px] w-[2px] -translate-x-1/2 md:hidden" />
      <span className="flow-arrow left-1/2 top-[20px] -translate-x-1/2 md:hidden" />

      {/* Wide: one drop per branch, landing on each column's centre. */}
      <span
        className="flow-rule left-1/4 top-[4px] hidden h-[18px] w-[2px] -translate-x-1/2 md:block"
        data-live={leftLive}
      />
      <span className="flow-arrow left-1/4 top-[20px] hidden -translate-x-1/2 md:block" data-live={leftLive} />
      <span
        className="flow-rule left-3/4 top-[4px] hidden h-[18px] w-[2px] -translate-x-1/2 md:block"
        data-live={rightLive}
      />
      <span className="flow-arrow left-3/4 top-[20px] hidden -translate-x-1/2 md:block" data-live={rightLive} />
    </div>
  );
}

/** Says why a tap did nothing, clear of the sticky tray at the bottom edge. */
function Nudge({ title, body }: { title: string; body: string }) {
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
