'use client';

import { useCallback, useId, useState, useTransition } from 'react';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { useReactionContext } from '@/components/reactions/ReactionProvider';
import { initialsFor } from '@/components/ui/Media';
import { formatCount } from '@/lib/domain/format';
import { COMMENT_MAX_LENGTH } from '@/lib/validation/schemas';
import type {
  CommentPage,
  CommentSort,
  CommentStanceFilter,
  CommentView,
  VoteValue,
} from '@/lib/services/comments';
import type { ArtifactCard, Stance } from '@/lib/domain/types';

/**
 * Open discussion on an artifact.
 *
 * The third measurement on the page, and the only one that changes nothing:
 * comments never move a reaction total or an opinion count, and the section
 * says so rather than leaving it to be inferred. Nothing here is gated on
 * having reacted — a person who has never sent an Egg or a Medal can write, and
 * appears without a badge rather than as a lesser participant.
 *
 * The stance badge reports the side the author took on *this* item, when they
 * took one. It never reports how many reactions they sent: the volume of
 * somebody's tapping is not a credential, and putting it beside their name
 * would turn the discussion into a second intensity chart.
 *
 * Votes are ordinary and reversible. They say "useful" or "not", not "critical"
 * or "appreciative", and the permanence rule that governs Eggs and Medals has
 * no part in them.
 */
export function CommentSection({
  card,
  initial,
  viewerName,
}: {
  card: ArtifactCard;
  initial: CommentPage;
  viewerName: string | null;
}) {
  const { isAuthenticated, requestSignIn } = useReactionContext();
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const headingId = useId();
  const fieldId = useId();

  const [sort, setSort] = useState<CommentSort>('new');
  const [stance, setStance] = useState<CommentStanceFilter>('all');
  const [page, setPage] = useState<CommentPage>(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [posting, setPosting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();

  const viewerStance = state.contribution.stance;

  const load = useCallback(
    async (nextSort: CommentSort, nextStance: CommentStanceFilter, offset = 0) => {
      const response = await fetch(
        `/api/comments?artifactType=${card.type}&artifactId=${encodeURIComponent(card.id)}` +
          `&sort=${nextSort}&stance=${nextStance}&offset=${offset}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        setError('Could not load the discussion. Try again.');
        return;
      }
      setError(null);
      const next = (await response.json()) as CommentPage;
      setPage((current) => (offset === 0 ? next : { ...next, comments: [...current.comments, ...next.comments] }));
    },
    [card.id, card.type],
  );

  const changeSort = (nextSort: CommentSort) => {
    if (nextSort === sort) return;
    setSort(nextSort);
    startTransition(() => {
      void load(nextSort, stance, 0);
    });
  };

  const changeStance = (nextStance: CommentStanceFilter) => {
    if (nextStance === stance) return;
    setStance(nextStance);
    startTransition(() => {
      void load(sort, nextStance, 0);
    });
  };

  const showMore = async () => {
    if (page.nextOffset === null) return;
    setLoadingMore(true);
    try {
      await load(sort, stance, page.nextOffset);
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) {
      requestSignIn();
      return;
    }

    const body = draft.trim();
    if (body.length < 2) {
      setError('Write at least a couple of characters.');
      return;
    }

    setPosting(true);
    setError(null);
    setPosted(false);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artifactType: card.type, artifactId: card.id, body }),
      });

      if (response.status === 401) {
        requestSignIn();
        return;
      }

      const payload = (await response.json()) as { comment?: CommentView; message?: string };
      if (!response.ok || !payload.comment) {
        setError(payload.message ?? 'That did not go through. Try again.');
        return;
      }

      const comment = payload.comment;
      setDraft('');
      setPosted(true);
      // Placed straight at the top rather than refetching: a person should see
      // their own comment the instant it lands, whichever ordering is active.
      setPage((current) => ({
        ...current,
        comments: [comment, ...current.comments.filter((existing) => existing.id !== comment.id)],
        total: current.total + 1,
        overallTotal: current.overallTotal + 1,
      }));
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const vote = async (comment: CommentView, value: Exclude<VoteValue, 0>) => {
    if (!isAuthenticated) {
      requestSignIn();
      return;
    }

    // Optimistic: the tally moves immediately and is corrected by the response.
    const previous = comment.viewerVote;
    const next: VoteValue = previous === value ? 0 : value;
    setPage((current) => ({
      ...current,
      comments: current.comments.map((item) =>
        item.id === comment.id
          ? {
              ...item,
              viewerVote: next,
              likeCount: item.likeCount + ((next === 1 ? 1 : 0) - (previous === 1 ? 1 : 0)),
              dislikeCount: item.dislikeCount + ((next === -1 ? 1 : 0) - (previous === -1 ? 1 : 0)),
            }
          : item,
      ),
    }));

    try {
      const response = await fetch(`/api/comments/${comment.id}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error('vote failed');

      const result = (await response.json()) as { likeCount: number; dislikeCount: number; viewerVote: VoteValue };
      setPage((current) => ({
        ...current,
        comments: current.comments.map((item) => (item.id === comment.id ? { ...item, ...result } : item)),
      }));
    } catch {
      // Put it back the way it was; the server is the authority.
      setPage((current) => ({
        ...current,
        comments: current.comments.map((item) => (item.id === comment.id ? comment : item)),
      }));
    }
  };

  const remove = async (comment: CommentView) => {
    const response = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('Could not remove that comment. Try again.');
      return;
    }
    setPage((current) => ({
      ...current,
      comments: current.comments.filter((item) => item.id !== comment.id),
      total: Math.max(0, current.total - 1),
      overallTotal: Math.max(0, current.overallTotal - 1),
    }));
  };

  const remaining = COMMENT_MAX_LENGTH - draft.length;
  const canPost = draft.trim().length >= 2 && !posting;

  return (
    <section aria-labelledby={headingId} className="paper p-[clamp(20px,2.6vw,40px)]">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3.5">
        <h2 id={headingId} className="display-sm m-0 flex items-center gap-3 text-[clamp(24px,2.8vw,40px)]">
          Discussion
          <span className="numeric bg-[color:var(--color-indigo)] px-[11px] py-[7px] text-[clamp(15px,1.4vw,20px)] font-extrabold leading-none text-paper">
            {formatCount(page.overallTotal)}
          </span>
        </h2>

        <div className="seg" role="group" aria-label="Sort comments">
          {(['new', 'top'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeSort(option)}
              aria-pressed={sort === option}
              className="seg-opt"
            >
              {option === 'new' ? 'Newest' : 'Top rated'}
            </button>
          ))}
        </div>
      </div>

      <p className="m-0 mt-3.5 max-w-[68ch] text-[14.5px] leading-[1.55] text-[rgb(23_20_15_/_0.68)]">
        Open to everyone with an account, whether or not you have reacted. Nothing written here changes a reaction
        total or an opinion count — those are counted separately and are not affected by anything said in this
        thread.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="eyebrow-ink">Filter</span>
        <div className="seg" role="group" aria-label="Filter comments by the commenter’s recorded position">
          {(
            [
              ['all', 'All'],
              ['positive', 'Appreciative'],
              ['negative', 'Critical'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeStance(value)}
              aria-pressed={stance === value}
              className="seg-opt"
            >
              {label}
            </button>
          ))}
        </div>
        {stance !== 'all' && (
          <span className="text-[12px] font-medium leading-[1.35] text-[rgb(23_20_15_/_0.62)]">
            Showing {formatCount(page.total)} of {formatCount(page.overallTotal)} — people who recorded{' '}
            {stance === 'negative' ? 'a critical' : 'an appreciative'} position.
          </span>
        )}
      </div>

      {/* --------------------------------- composer -------------------------- */}

      <form onSubmit={submit} className="mt-[22px] border-2 border-ink">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--rule-default)] px-4 py-3.5">
          <Avatar name={viewerName} />
          <div className="min-w-0">
            <p className="m-0 text-[14.5px] font-extrabold leading-none">Join the discussion</p>
            <p className="m-0 mt-1.5 text-[12px] font-medium leading-none text-[rgb(23_20_15_/_0.62)]">
              {viewerName ?? 'Not signed in'}
            </p>
          </div>
          {viewerStance && <StanceBadge stance={viewerStance} />}
        </div>

        <label htmlFor={fieldId} className="sr-only">
          Write a comment
        </label>
        <textarea
          id={fieldId}
          value={draft}
          disabled={posting}
          aria-describedby={`${fieldId}-rules`}
          onChange={(event) => {
            setDraft(event.target.value.slice(0, COMMENT_MAX_LENGTH));
            if (posted) setPosted(false);
          }}
          onFocus={() => {
            if (!isAuthenticated) requestSignIn();
          }}
          placeholder={isAuthenticated ? 'What should people know about this?' : 'Sign in to comment…'}
          className="block min-h-[clamp(110px,11vw,140px)] w-full resize-y border-0 bg-transparent p-4 text-[clamp(16px,1.25vw,19px)] leading-[1.5] text-ink outline-none placeholder:text-[rgb(23_20_15_/_0.45)] disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule-default)] px-3.5 py-3">
          <p
            id={`${fieldId}-rules`}
            className="m-0 max-w-[44ch] text-[12.5px] font-medium leading-[1.4] text-[rgb(23_20_15_/_0.62)]"
          >
            Be specific. Be fair. Criticize actions, not identities.
          </p>

          <div className="flex items-center gap-3">
            <span
              className={`numeric text-[12px] font-bold leading-none ${
                remaining < 40 ? 'text-[color:var(--color-egg-deep)]' : 'text-[rgb(23_20_15_/_0.55)]'
              }`}
              aria-live="polite"
            >
              {formatCount(remaining)} left
            </span>
            <button
              type="submit"
              disabled={!canPost}
              className={`btn min-h-11 flex-none px-[18px] py-3.5 text-[13.5px] font-extrabold tracking-[0.02em] ${
                canPost ? 'border-2 border-ink bg-egg text-ink' : 'bg-[rgb(23_20_15_/_0.1)] text-[rgb(23_20_15_/_0.6)]'
              }`}
            >
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-bold text-[color:var(--color-egg-deep)]">
          {error}
        </p>
      )}
      {posted && !error && (
        <p role="status" className="mt-3 text-[13px] font-bold text-ink">
          Posted. It is at the top of the thread.
        </p>
      )}

      {/* ---------------------------------- thread --------------------------- */}

      {isPending ? (
        <ThreadSkeleton />
      ) : page.comments.length === 0 ? (
        <EmptyThread
          stance={stance}
          isAuthenticated={isAuthenticated}
          onClearFilter={() => changeStance('all')}
        />
      ) : (
        <ul className="mt-[22px] flex flex-col">
          {page.comments.map((comment, index) => (
            <li
              key={comment.id}
              className={`border-t border-[var(--rule-subtle)] px-3 py-[18px] ${
                index % 2 === 1 ? 'bg-[rgb(23_20_15_/_0.035)]' : ''
              }`}
            >
              <Comment comment={comment} onVote={vote} onDelete={remove} />
            </li>
          ))}
        </ul>
      )}

      {page.nextOffset !== null && !isPending && (
        <button
          type="button"
          onClick={() => void showMore()}
          disabled={loadingMore}
          className="btn btn-ink mt-4 px-4 py-3"
        >
          {loadingMore ? 'Loading…' : 'Show more comments'}
        </button>
      )}
    </section>
  );
}

/* --------------------------------- pieces ---------------------------------- */

function Comment({
  comment,
  onVote,
  onDelete,
}: {
  comment: CommentView;
  onVote: (comment: CommentView, value: Exclude<VoteValue, 0>) => void;
  onDelete: (comment: CommentView) => void;
}) {
  const score = comment.likeCount - comment.dislikeCount;

  return (
    <article className="flex gap-3.5">
      <Avatar name={comment.author.displayName} />

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] font-extrabold leading-none tracking-[0.02em]">
            {comment.author.displayName}
          </span>
          <StanceBadge stance={comment.authorStance} />
          <RelativeTime
            iso={comment.createdAt}
            className="text-[11.5px] font-medium uppercase leading-none tracking-[0.06em] text-[rgb(23_20_15_/_0.62)]"
          />
        </div>

        <p className="m-0 max-w-[72ch] whitespace-pre-line text-pretty text-[15.5px] leading-[1.55]">
          {comment.body}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <VoteButton
            label="like"
            active={comment.viewerVote === 1}
            count={comment.likeCount}
            onClick={() => onVote(comment, 1)}
          />
          <VoteButton
            label="dislike"
            active={comment.viewerVote === -1}
            count={comment.dislikeCount}
            onClick={() => onVote(comment, -1)}
          />
          <span
            className="numeric ml-1 text-[11.5px] font-bold uppercase leading-none tracking-[0.06em] text-[rgb(23_20_15_/_0.6)]"
            aria-label={`Score ${score}`}
          >
            {score > 0 ? `+${formatCount(score)}` : score < 0 ? `−${formatCount(Math.abs(score))}` : '0'}
          </span>

          {comment.viewerCanDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment)}
              className="btn btn-ink ml-auto min-h-9 px-2.5 text-xs font-bold text-[rgb(23_20_15_/_0.62)] hover:text-ink"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function VoteButton({
  label,
  active,
  count,
  onClick,
}: {
  label: 'like' | 'dislike';
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={
        active
          ? `Remove your ${label} — ${count} so far`
          : `${label === 'like' ? 'Like' : 'Dislike'} this comment — ${count} so far`
      }
      className={`btn btn-ink min-h-9 gap-1.5 ${active ? 'border-ink bg-ink text-paper' : ''}`}
    >
      <span aria-hidden="true" className={label === 'dislike' ? 'inline-block rotate-180' : 'inline-block'}>
        ▲
      </span>
      <span className="numeric">{formatCount(count)}</span>
    </button>
  );
}

/** Initials in an ink square. No photographs anywhere in this system. */
function Avatar({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 flex-none items-center justify-center border-2 border-ink bg-[rgb(23_20_15_/_0.06)] text-[13px] font-extrabold leading-none"
    >
      {name ? initialsFor(name) : '—'}
    </span>
  );
}

/**
 * The side this author took, when they took one.
 *
 * A person with no recorded side is labelled plainly rather than left blank —
 * an absent badge would read as a missing value instead of a real state.
 */
function StanceBadge({ stance }: { stance: Stance | null }) {
  if (!stance) {
    return (
      <span className="border border-[var(--rule-default)] px-1.5 py-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.06em] text-[rgb(23_20_15_/_0.5)]">
        No position
      </span>
    );
  }

  const negative = stance === 'negative';
  return (
    <span
      className={`px-1.5 py-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.06em] text-ink ${
        negative ? 'bg-egg' : 'bg-medal'
      }`}
    >
      {negative ? 'Critical' : 'Appreciative'}
    </span>
  );
}

function ThreadSkeleton() {
  return (
    <div className="mt-[22px]" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-3.5 border-t border-[var(--rule-subtle)] px-3 py-[18px]">
          <span className="h-10 w-10 flex-none bg-[rgb(23_20_15_/_0.09)]" />
          <div className="min-w-0 flex-1">
            <span className="block h-3 w-[140px] bg-[rgb(23_20_15_/_0.09)]" />
            <span className="mt-2.5 block h-3 w-full max-w-[52ch] bg-[rgb(23_20_15_/_0.07)]" />
            <span className="mt-1.5 block h-3 w-full max-w-[34ch] bg-[rgb(23_20_15_/_0.07)]" />
          </div>
        </div>
      ))}
      <p className="sr-only" role="status">
        Loading comments.
      </p>
    </div>
  );
}

function EmptyThread({
  stance,
  isAuthenticated,
  onClearFilter,
}: {
  stance: CommentStanceFilter;
  isAuthenticated: boolean;
  onClearFilter: () => void;
}) {
  if (stance !== 'all') {
    return (
      <div className="mt-[22px] border-t border-[var(--rule-subtle)] pt-[22px]">
        <div className="display-sm text-[clamp(20px,2.2vw,30px)]">Nothing from this side yet.</div>
        <p className="m-0 mt-2.5 max-w-[48ch] text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.66)]">
          Nobody who recorded {stance === 'negative' ? 'a critical' : 'an appreciative'} position has written here.
        </p>
        <button type="button" onClick={onClearFilter} className="btn btn-ink mt-3.5 px-4 py-3">
          Show every comment
        </button>
      </div>
    );
  }

  return (
    <div className="mt-[22px] border-t border-[var(--rule-subtle)] pt-[22px]">
      <div className="display-sm text-[clamp(20px,2.2vw,30px)]">No takes yet. Set the tone.</div>
      <p className="m-0 mt-2.5 max-w-[50ch] text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.66)]">
        {isAuthenticated
          ? 'Say what someone arriving here ought to know — the detail the headline left out.'
          : 'Sign in and say what someone arriving here ought to know.'}
      </p>
    </div>
  );
}
