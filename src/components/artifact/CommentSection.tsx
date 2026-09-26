'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { useReactionContext } from '@/components/reactions/ReactionProvider';
import { initialsFor } from '@/components/ui/Media';
import { formatCount } from '@/lib/domain/format';
import { COMMENT_MAX_LENGTH } from '@/lib/validation/schemas';
import { Modal } from '@/components/ui/Modal';
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@/lib/domain/reports';
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
  renderedAt,
}: {
  card: ArtifactCard;
  initial: CommentPage;
  viewerName: string | null;
  /** When the server rendered `initial`; an old one is refreshed on arrival. */
  renderedAt?: number;
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
  const [reporting, setReporting] = useState<CommentView | null>(null);
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

  /*
   * The browser reuses a visited page for a short while on back and forward.
   * That is what makes those moves instant, but the thread it reuses may be
   * missing a comment posted since — so a thread rendered more than a few
   * seconds ago quietly fetches its first page again when it appears.
   */
  useEffect(() => {
    if (renderedAt !== undefined && Date.now() - renderedAt > 5000) void load('new', 'all', 0);
    // Once, on arrival. Later changes come from the person's own filters.
  }, []);

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

  const startReport = (comment: CommentView) => {
    if (!isAuthenticated) {
      requestSignIn();
      return;
    }
    setReporting(comment);
  };

  const markReported = (commentId: string) => {
    setPage((current) => ({
      ...current,
      comments: current.comments.map((item) => (item.id === commentId ? { ...item, viewerHasReported: true } : item)),
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
            className="m-0 max-w-[52ch] text-[12.5px] font-medium leading-[1.4] text-[rgb(23_20_15_/_0.62)]"
          >
            Criticize actions, not identities. Don’t post private information or unverified claims.
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
              <Comment comment={comment} onVote={vote} onDelete={remove} onReport={startReport} />
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

      <ReportDialog
        comment={reporting}
        onClose={() => setReporting(null)}
        onReported={markReported}
        onSignInNeeded={() => {
          setReporting(null);
          requestSignIn();
        }}
      />
    </section>
  );
}

/* --------------------------------- pieces ---------------------------------- */

function Comment({
  comment,
  onVote,
  onDelete,
  onReport,
}: {
  comment: CommentView;
  onVote: (comment: CommentView, value: Exclude<VoteValue, 0>) => void;
  onDelete: (comment: CommentView) => void;
  onReport: (comment: CommentView) => void;
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
          <CommentMenu comment={comment} onDelete={onDelete} onReport={onReport} />
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
        </div>
      </div>
    </article>
  );
}

/**
 * The three-dot menu on a comment.
 *
 * Report sits behind it rather than beside the votes so it is there when
 * needed and never the first thing within reach. Delete moved in with it: both
 * are rare, and a bare Delete next to Like is one slip from the wrong tap.
 *
 * Follows the menu-button pattern: arrow keys move between items, Escape and
 * Tab close, and focus goes back to the button it came from.
 */
function CommentMenu({
  comment,
  onDelete,
  onReport,
}: {
  comment: CommentView;
  onDelete: (comment: CommentView) => void;
  onReport: (comment: CommentView) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const items = (): HTMLElement[] =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();

    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKey = (event: React.KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      list[(index + step + list.length) % list.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      list[event.key === 'Home' ? 0 : list.length - 1]?.focus();
    }
  };

  const canReport = !comment.viewerIsAuthor;

  return (
    <div ref={wrapperRef} className="relative ml-auto">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`More options for ${comment.author.displayName}’s comment`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-9 w-9 items-center justify-center border-2 text-ink transition-colors duration-150 ${
          open ? 'border-ink bg-[rgb(23_20_15_/_0.08)]' : 'border-transparent hover:border-ink'
        }`}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
          <circle cx="9" cy="3.5" r="1.9" />
          <circle cx="9" cy="9" r="1.9" />
          <circle cx="9" cy="14.5" r="1.9" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label="Comment options"
          className="menu-list pop-in"
          onKeyDown={onMenuKey}
        >
          {canReport &&
            (comment.viewerHasReported ? (
              <div role="menuitem" tabIndex={-1} aria-disabled="true" className="menu-item">
                <span aria-hidden="true">✓</span> Reported — thanks
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="menu-item"
                onClick={() => {
                  // Focus goes back to the button first, so the dialog returns it there.
                  close(true);
                  onReport(comment);
                }}
              >
                <span aria-hidden="true">⚑</span> Report comment
              </button>
            ))}
          {comment.viewerCanDelete && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="menu-item text-[color:var(--color-negative-deep)]"
              onClick={() => {
                close(true);
                onDelete(comment);
              }}
            >
              <span aria-hidden="true">✕</span> Delete comment
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Why a comment is being reported. One modal for the whole thread, pointed at
 * whichever comment asked for it.
 */
function ReportDialog({
  comment,
  onClose,
  onReported,
  onSignInNeeded,
}: {
  comment: CommentView | null;
  onClose: () => void;
  onReported: (commentId: string) => void;
  onSignInNeeded: () => void;
}) {
  const headingId = useId();
  const detailsId = useId();
  const firstReasonRef = useRef<HTMLInputElement | null>(null);
  const doneRef = useRef<HTMLButtonElement | null>(null);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // A fresh form for each comment.
  const commentId = comment?.id ?? null;
  useEffect(() => {
    setReason(null);
    setDetails('');
    setError(null);
    setSent(false);
    setSending(false);
  }, [commentId]);

  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  const needsDetails = reason === 'other';
  const canSend = reason !== null && (!needsDetails || details.trim().length >= 3) && !sending;

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment || !reason || !canSend) return;
    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/comments/${comment.id}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });

      if (response.status === 401) {
        onSignInNeeded();
        return;
      }
      if (response.status === 429) {
        setError('You have sent a lot of reports in a short time. Try again later.');
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message ?? 'That did not go through. Try again.');
        return;
      }

      onReported(comment.id);
      setSent(true);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={comment !== null}
      onClose={onClose}
      labelledBy={headingId}
      initialFocus={firstReasonRef}
      dismissible={!sending}
    >
      {comment &&
        (sent ? (
          <div role="status">
            <p className="eyebrow-ink m-0">Report received</p>
            <h2 id={headingId} className="display-sm m-0 mt-2.5 text-[clamp(22px,2.4vw,28px)]">
              Thanks. We will take a look.
            </h2>
            <p className="m-0 mt-3 text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.75)]">
              A moderator reviews every report. The comment stays up until then, and {comment.author.displayName} is
              not told who reported it.
            </p>
            <div className="mt-5 flex justify-end">
              <button ref={doneRef} type="button" onClick={onClose} className="btn btn-ink min-h-11 px-4 py-3 text-[14px]">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={send}>
            <p className="eyebrow-ink m-0">Report comment</p>
            <h2 id={headingId} className="display-sm m-0 mt-2.5 text-[clamp(22px,2.4vw,28px)]">
              What is wrong with it?
            </h2>

            <blockquote className="m-0 mt-3.5 border-l-4 border-ink bg-[rgb(23_20_15_/_0.05)] px-3.5 py-2.5 text-[13.5px] leading-[1.5]">
              <span className="block text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[rgb(23_20_15_/_0.6)]">
                {comment.author.displayName}
              </span>
              <span className="line-clamp-3 whitespace-pre-line">{comment.body}</span>
            </blockquote>

            <fieldset className="m-0 mt-4 border-0 p-0">
              <legend className="sr-only">Reason</legend>
              <div className="flex flex-col gap-1.5">
                {REPORT_REASONS.map((value, index) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3 border-2 px-3 py-2.5 transition-colors duration-150 ${
                      reason === value ? 'border-ink bg-[rgb(23_20_15_/_0.06)]' : 'border-[var(--rule-default)] hover:border-ink'
                    }`}
                  >
                    <input
                      ref={index === 0 ? firstReasonRef : undefined}
                      type="radio"
                      name="report-reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-ink)]"
                    />
                    <span>
                      <span className="block text-[14px] font-extrabold leading-[1.25]">
                        {REPORT_REASON_LABELS[value].label}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-[1.4] text-[rgb(23_20_15_/_0.66)]">
                        {REPORT_REASON_LABELS[value].hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {reason && (
              <div className="mt-3.5">
                <label htmlFor={detailsId} className="text-[12.5px] font-bold">
                  {needsDetails ? 'What is wrong?' : 'Anything to add? (optional)'}
                </label>
                <textarea
                  id={detailsId}
                  value={details}
                  onChange={(event) => setDetails(event.target.value.slice(0, REPORT_DETAILS_MAX_LENGTH))}
                  rows={2}
                  required={needsDetails}
                  className="mt-1.5 block w-full resize-y border-2 border-ink bg-transparent p-2.5 text-[14px] leading-[1.45] outline-none focus-visible:shadow-[3px_3px_0_var(--color-ink)]"
                />
              </div>
            )}

            <p className="m-0 mt-3.5 text-[12.5px] leading-[1.45] text-[rgb(23_20_15_/_0.62)]">
              Reports are for comments that break the rules — not for ones you disagree with. That is what the
              dislike button is for.
            </p>

            {error && (
              <p role="alert" className="m-0 mt-3 text-[13.5px] font-bold text-[color:var(--color-negative-deep)]">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="btn btn-ink min-h-11 px-4 py-3 text-[14px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSend}
                className={`btn min-h-11 px-4 py-3 text-[14px] font-extrabold ${
                  canSend ? 'border-2 border-ink bg-ink text-paper' : 'bg-[rgb(23_20_15_/_0.1)] text-[rgb(23_20_15_/_0.6)]'
                }`}
              >
                {sending ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        ))}
    </Modal>
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
