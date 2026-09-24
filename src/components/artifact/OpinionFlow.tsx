'use client';

import { useEffect, useRef, useState } from 'react';
import { ParticleLayer } from '@/components/reactions/ParticleLayer';
import { useArtifact } from '@/components/reactions/useArtifact';
import { useHoldToReact } from '@/components/reactions/useHoldToReact';
import { useReactionContext } from '@/components/reactions/ReactionProvider';
import { reactionStore } from '@/lib/client/reaction-store';
import { Overlay } from '@/components/ui/Overlay';
import { Modal } from '@/components/ui/Modal';
import { formatCount, sharePercent } from '@/lib/domain/format';
import { contributorPhrase } from '@/lib/domain/copy';
import { canChangeSide } from '@/lib/domain/types';
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
 * commits the opinion. On a Flash News item the other branch is then visibly
 * locked rather than hidden: a person should be able to see the rule being
 * applied to them. On an Entity it stays open behind a confirmation, because
 * a standing record is allowed a change of mind — and the confirmation says
 * plainly that everything already sent stays counted.
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
    emoji: '🏅',
    kind: 'medal',
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
    emoji: '🥚',
    kind: 'egg',
  },
} as const;

export function OpinionFlow({ card }: { card: ArtifactCard }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const { isAuthenticated } = useReactionContext();

  const committed = state.contribution.stance;
  const selected = committed ?? state.selectedStance;
  const switchable = canChangeSide(card.type);

  /*
   * A change of side on an Entity goes through a confirmation. It moves two
   * public head counts at once, and the person should hear — before they do
   * it — that the reactions they already sent are staying where they are.
   */
  const [pendingSwitch, setPendingSwitch] = useState<Stance | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  const cancelSwitch = () => {
    setPendingSwitch(null);
    setSwitchError(null);
  };

  const confirmSwitch = async () => {
    if (!pendingSwitch) return;
    setSwitching(true);
    setSwitchError(null);
    const result = await reactionStore.switchStance(card.type, card.id, pendingSwitch);
    setSwitching(false);
    if (result.ok) {
      setPendingSwitch(null);
      return;
    }
    setSwitchError(
      result.reason === 'rate_limited'
        ? 'That is a lot of changes in a short time. Try again in a few minutes.'
        : result.reason === 'unauthenticated'
          ? 'Sign in to change your position.'
          : 'That did not go through. Nothing changed — try again.',
    );
  };

  /*
   * Commitment is announced once, quietly. Reaction totals are announced by the
   * hold hook on its own throttle, so a burst of taps never floods a reader.
   */
  const [commitmentNote, setCommitmentNote] = useState('');
  const previouslyCommitted = useRef<Stance | null>(committed);

  useEffect(() => {
    const before = previouslyCommitted.current;
    if (committed && before !== committed) {
      const side = committed === 'negative' ? 'negative' : 'positive';
      const open = committed === 'negative' ? 'Rotten Eggs' : 'Medals';
      const closed = committed === 'negative' ? 'Medals' : 'Rotten Eggs';
      setCommitmentNote(
        before
          ? `Your position is now ${side}. ${open} are open to you and ${closed} are closed. Everything you sent before still counts.`
          : `Your position is recorded as ${side}. ${open} stay open to you; ${closed} are now closed on this item.`,
      );
    }
    previouslyCommitted.current = committed;
  }, [committed]);

  const ownOnCurrent = committed === 'negative' ? state.contribution.rottenEggCount : state.contribution.medalCount;

  const critical = state.totals.negativeOpinionTotal;
  const appreciative = state.totals.positiveOpinionTotal;
  const people = critical + appreciative;

  return (
    <section
      aria-labelledby={`${card.id}-flow-heading`}
      className="paper p-[clamp(18px,2.4vw,36px)]"
      id="reaction-controls"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h2 id={`${card.id}-flow-heading`} className="display-sm m-0 text-[clamp(22px,2.4vw,34px)]">
          Where do you stand?
        </h2>

        <p className="m-0 max-w-[58ch] flex-[1_1_320px] text-[13px] leading-[1.5] text-[rgb(23_20_15_/_0.66)]">
          Your position counts you once, whatever happens next. Reactions are unlimited and measure how strongly you
          feel — they never make you count twice.
        </p>
      </div>

      {/*
       * One grid, two arrangements. The areas are named rather than positional
       * so the phone layout and the desktop one are the same markup read in
       * two directions — no second copy of the controls, and no duplicate
       * radio inputs for a screen reader to trip over.
       */}
      <div className="opinion-flow mt-[clamp(18px,2.2vw,30px)]">
        <p className="eyebrow-ink mb-3 lg:mb-2.5" style={{ gridArea: 'head1' }}>
          Step 1 — Pick your position
        </p>

        <div className="flow-origin">
          <span className="flow-node">You</span>
          <span className="flow-fork" aria-hidden="true">
            <span className="flow-fork-stem" />
            <span className="flow-fork-rail" />
            <span className="flow-fork-arm" data-arm="a" data-live={selected === null || selected === 'positive'} />
            <span className="flow-fork-arm" data-arm="b" data-live={selected === null || selected === 'negative'} />
          </span>
        </div>

        {/*
         * `display: contents` lets the two choices sit in their own grid areas
         * while the group that binds them stays in the accessibility tree.
         */}
        <div role="radiogroup" aria-label="Your position on this item" className="contents">
          <OpinionChoice
            card={card}
            branch="positive"
            count={appreciative}
            people={people}
            selected={selected === 'positive'}
            committed={committed}
            switchable={switchable}
            onRequestSwitch={setPendingSwitch}
          />
          <OpinionChoice
            card={card}
            branch="negative"
            count={critical}
            people={people}
            selected={selected === 'negative'}
            committed={committed}
            switchable={switchable}
            onRequestSwitch={setPendingSwitch}
          />
        </div>

        <p className="eyebrow-ink mb-3 mt-[clamp(16px,2vw,22px)] lg:mb-2.5 lg:mt-0" style={{ gridArea: 'head2' }}>
          Step 2 — Express the intensity
        </p>

        <span
          className="flow-link"
          style={{ gridArea: 'linkA' }}
          data-live={selected === null || selected === 'positive'}
          aria-hidden="true"
        />
        <span
          className="flow-link"
          style={{ gridArea: 'linkB' }}
          data-live={selected === null || selected === 'negative'}
          aria-hidden="true"
        />

        <ReactionBranch
          card={card}
          branch="positive"
          selected={selected}
          committed={committed}
          switchable={switchable}
        />
        <ReactionBranch
          card={card}
          branch="negative"
          selected={selected}
          committed={committed}
          switchable={switchable}
        />
      </div>

      <Modal
        open={pendingSwitch !== null && committed !== null}
        onClose={cancelSwitch}
        labelledBy={`${card.id}-switch-heading`}
        describedBy={`${card.id}-switch-body`}
        initialFocus={confirmRef}
        dismissible={!switching}
      >
        {pendingSwitch && committed && (
          <>
            <p className="eyebrow-ink m-0">Change your position</p>
            <h2 id={`${card.id}-switch-heading`} className="display-sm m-0 mt-2.5 text-[clamp(22px,2.4vw,28px)]">
              Switch to {pendingSwitch === 'positive' ? 'Positive' : 'Negative'}?
            </h2>

            <div className="mt-4 flex items-center gap-2.5" aria-hidden="true">
              <SideChip stance={committed} />
              <span className="text-[18px] font-extrabold leading-none">→</span>
              <SideChip stance={pendingSwitch} />
            </div>

            <div id={`${card.id}-switch-body`}>
              <p className="m-0 mt-4 text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.78)]">
                You will count as {pendingSwitch === 'positive' ? 'appreciative' : 'critical'} from now on, and{' '}
                {pendingSwitch === 'positive' ? 'Medals' : 'Rotten Eggs'} open up in place of{' '}
                {pendingSwitch === 'positive' ? 'Rotten Eggs' : 'Medals'}.
              </p>
              <p className="m-0 mt-2.5 text-[14.5px] font-bold leading-[1.5]">
                {ownOnCurrent > 0
                  ? `The ${formatCount(ownOnCurrent)} ${
                      committed === 'negative'
                        ? ownOnCurrent === 1
                          ? 'Rotten Egg'
                          : 'Rotten Eggs'
                        : ownOnCurrent === 1
                          ? 'Medal'
                          : 'Medals'
                    } you already sent stay on the record.`
                  : 'Nothing you have already done is removed.'}
              </p>
            </div>

            {switchError && (
              <p role="alert" className="m-0 mt-3.5 text-[13.5px] font-bold text-[color:var(--color-negative-deep)]">
                {switchError}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={cancelSwitch}
                disabled={switching}
                className="btn btn-ink min-h-11 px-4 py-3 text-[14px]"
              >
                Keep {committed === 'positive' ? 'Positive' : 'Negative'}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => void confirmSwitch()}
                disabled={switching}
                className={`btn min-h-11 w-auto px-4 py-3 text-[14px] font-extrabold ${
                  pendingSwitch === 'positive' ? 'btn-positive' : 'btn-negative'
                }`}
              >
                {switching ? 'Switching…' : `Switch to ${pendingSwitch === 'positive' ? 'Positive' : 'Negative'}`}
              </button>
            </div>
          </>
        )}
      </Modal>

      <p className="m-0 mt-[clamp(14px,1.8vw,22px)] max-w-[80ch] text-[13px] leading-[1.5] text-[rgb(23_20_15_/_0.62)]">
        {committed
          ? switchable
            ? `Your position is recorded. This is a standing record, so you can switch sides whenever your view changes — pick the other position above. Everything you have already sent stays counted either way.`
            : `Your position is recorded and final, so the ${
                committed === 'negative' ? 'Medal' : 'Rotten Egg'
              } branch is closed to you here. You can keep adding ${
                committed === 'negative' ? 'Rotten Eggs' : 'Medals'
              } for as long as you like — they raise the reaction total, never the head count.`
          : selected
            ? switchable
              ? 'Nothing is recorded yet. Your first reaction records your position — and on a profile you can change it later.'
              : 'Nothing is recorded yet. You can still switch sides until your first reaction lands, and that reaction is what fixes your position for good.'
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

/** A side, as the modal names it: the branch colour and its emoji. */
function SideChip({ stance }: { stance: Stance }) {
  const positive = stance === 'positive';
  return (
    <span
      className="inline-flex items-center gap-2 border-2 border-ink px-2.5 py-1.5 text-[13px] font-extrabold leading-none text-ink"
      style={{ backgroundColor: positive ? 'var(--color-positive)' : 'var(--color-negative)' }}
    >
      <span className="text-[16px]">{positive ? '🏅' : '🥚'}</span>
      {positive ? 'Positive' : 'Negative'}
    </span>
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
  switchable,
  onRequestSwitch,
}: {
  card: ArtifactCard;
  branch: keyof typeof BRANCH;
  count: number;
  people: number;
  selected: boolean;
  committed: Stance | null;
  switchable: boolean;
  onRequestSwitch: (stance: Stance) => void;
}) {
  const copy = BRANCH[branch];
  const isCommittedHere = committed === copy.stance;
  const isOtherSide = committed !== null && !isCommittedHere;
  // On a Flash News item the other side is closed; on an Entity it is a switch away.
  const isLockedOut = isOtherSide && !switchable;
  const canSwitchHere = isOtherSide && switchable;
  const percent = people > 0 ? sharePercent(count, people) : null;

  return (
    <label
      style={{ gridArea: branch === 'positive' ? 'pos' : 'neg' }}
      /*
       * A column, not a block: the two branch rows are equal height, so the
       * shorter card would otherwise stretch and leave its count floating in
       * the middle of a gap. The count is pushed to the foot instead, where it
       * sits on the same line as the one beside it.
       */
      className={`relative flex cursor-pointer flex-col border-2 p-[clamp(12px,1.5vw,20px)] transition-colors ${
        isLockedOut ? 'branch-muted cursor-not-allowed border-[var(--rule-default)]' : 'border-ink'
      } ${
        selected
          ? branch === 'positive'
            ? 'branch-live bg-[color:var(--color-positive)]'
            : 'branch-live bg-[color:var(--color-negative)]'
          : 'bg-[rgb(23_20_15_/_0.03)]'
      } has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-[color:var(--color-indigo)]`}
    >
      <input
        type="radio"
        name={`position-${card.type}-${card.id}`}
        value={copy.stance}
        checked={selected}
        disabled={isLockedOut}
        aria-describedby={canSwitchHere ? `${card.id}-${copy.stance}-switch-hint` : undefined}
        onChange={() => {
          if (canSwitchHere) onRequestSwitch(copy.stance);
          else reactionStore.select(card.type, card.id, copy.stance);
        }}
        className="sr-only"
      />

      <span className="flex flex-wrap items-center gap-2.5">
        <span className="emoji-chip" data-kind={copy.kind} aria-hidden="true">
          {copy.emoji}
        </span>
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
        {canSwitchHere && (
          <span
            id={`${card.id}-${copy.stance}-switch-hint`}
            className="ml-auto border border-dashed border-ink px-1.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.08em]"
          >
            ⇄ Switch here
          </span>
        )}
      </span>

      {/* Full ink on a filled card: the muted tone would sink into the red. */}
      <span
        className={`mt-2 block text-[12.5px] font-medium leading-[1.4] ${
          selected ? 'text-ink' : 'text-[rgb(23_20_15_/_0.72)]'
        }`}
      >
        “{copy.opinionClaim}”
      </span>

      <span
        className="numeric-lg mt-auto block pt-3"
        style={{ fontSize: 'clamp(30px,4vw,54px)', lineHeight: 0.86 }}
      >
        {formatCount(count)}
      </span>

      <span className="mt-1.5 block text-[12px] font-bold leading-[1.35]">
        {count === 1 ? `1 ${copy.peopleNoun} person` : `${formatCount(count)} ${copy.peopleNoun} people`}
        {percent !== null && (
          <span className={`font-medium ${selected ? 'text-ink' : 'text-[rgb(23_20_15_/_0.66)]'}`}> · {percent}%</span>
        )}
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
  switchable,
}: {
  card: ArtifactCard;
  branch: keyof typeof BRANCH;
  selected: Stance | null;
  committed: Stance | null;
  switchable: boolean;
}) {
  const copy = BRANCH[branch];
  const other = copy.stance === 'positive' ? 'Negative' : 'Positive';
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
      style={{ gridArea: branch === 'positive' ? 'medal' : 'egg' }}
      className={`border-2 p-[clamp(14px,1.7vw,22px)] ${
        isLive
          ? 'branch-live border-ink bg-paper'
          : 'branch-muted border-[var(--rule-default)] bg-[rgb(23_20_15_/_0.03)]'
      }`}
    >
      <ParticleLayer handleRef={particleRef} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The step number lives in the column header; this says which branch. */}
          <p className="eyebrow-ink">{copy.opinionTitle} branch</p>
          <h3 className="display-sm m-0 mt-2 text-[clamp(17px,1.8vw,24px)]">{copy.step2Title}</h3>
        </div>
        <span className="emoji-chip" data-kind={copy.kind} style={{ '--chip': '42px' } as React.CSSProperties} aria-hidden="true">
          {copy.emoji}
        </span>
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
          color: copy.reactionType === 'rotten_egg' ? 'var(--color-negative-deep)' : 'var(--color-positive-deep)',
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
          !isLive ? 'btn-locked' : copy.reactionType === 'rotten_egg' ? 'btn-negative' : 'btn-positive'
        }`}
      >
        {isLockedOut ? (
          switchable ? (
            `Switch to ${copy.opinionTitle} to unlock`
          ) : (
            'Closed to you 🔒'
          )
        ) : !isLive ? (
          'Pick a position to unlock'
        ) : (
          <>
            {own > 0 ? copy.actionAgain : copy.action}
            <span className="emoji text-[1.15em]" aria-hidden="true">
              {copy.emoji}
            </span>
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
          title={
            isLockedOut
              ? switchable
                ? `Your position is ${other}.`
                : `The ${copy.step2Title} branch is closed to you.`
              : 'Pick a position first.'
          }
          body={
            isLockedOut
              ? switchable
                ? `To send these, switch to ${copy.opinionTitle} above. Everything you have already sent stays counted.`
                : `You recorded the opposite position on this item, and that is final. ${
                    copy.reactionType === 'rotten_egg' ? 'Medals' : 'Rotten Eggs'
                  } stay unlimited.`
              : `Choose ${copy.opinionTitle} above to unlock this. Choosing records nothing — your first reaction does.`
          }
        />
      )}
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
        <div
          className="pop-in border-2 border-ink bg-paper px-[18px] py-[15px] text-ink"
          style={{ boxShadow: '5px 5px 0 var(--color-ink)' }}
        >
          <div className="text-[16.5px] font-extrabold leading-[1.2]">{title}</div>
          <p className="mt-[7px] text-[13px] font-medium leading-[1.45] text-[rgb(23_20_15_/_0.78)]">{body}</p>
        </div>
      </div>
    </Overlay>
  );
}
