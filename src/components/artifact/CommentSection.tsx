'use client';

import { useCallback, useId, useState, useTransition } from 'react';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useReactionContext } from '@/components/reactions/ReactionProvider';
import { formatCount } from '@/lib/domain/format';
import { COMMENT_MAX_LENGTH } from '@/lib/validation/schemas';
import type { CommentPage, CommentSort, CommentView, VoteValue } from '@/lib/services/comments';
import type { ArtifactType } from '@/lib/domain/types';

/**
 * Open discussion on an artifact.
 *
 * Nothing here is gated on having reacted, and the section says so: a person
 * who has never sent an Egg or a Medal can write, and the badge next to a name
 * reports the side that person took only when they took one. Votes on a comment
 * are ordinary and reversible — they are not stances, and the permanence rule
 * that governs Eggs and Medals has no part in them.
 *
 * The count rides in an indigo chip beside the title: discussion is the third
 * measurement on the page, and it gets a colour neither reaction owns.
 */
export function CommentSection({
  artifactType,
  artifactId,
  initial,
  viewerName,
}: {
  artifactType: ArtifactType;
  artifactId: string;
  initial: CommentPage;
  viewerName: string | null;
}) {
  const { isAuthenticated, requestSignIn } = useReactionContext();
  const headingId = useId();
  const fieldId = useId();

  const [sort, setSort] = useState<CommentSort>('new');
  const [page, setPage] = useState<CommentPage>(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(
    async (nextSort: CommentSort, offset = 0) => {
      const response = await fetch(
        `/api/comments?artifactType=${artifactType}&artifactId=${encodeURIComponent(artifactId)}&sort=${nextSort}&offset=${offset}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      const next = (await response.json()) as CommentPage;
      setPage((current) => (offset === 0 ? next : { ...next, comments: [...current.comments, ...next.comments] }));
    },
    [artifactId, artifactType],
  );

  const changeSort = (nextSort: CommentSort) => {
    if (nextSort === sort) return;
    setSort(nextSort);
    startTransition(() => {
      void load(nextSort, 0);
    });
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

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artifactType, artifactId, body }),
      });

      if (response.status === 401) {
        requestSignIn();
        return;
      }

      const payload = (await response.json()) as {
        comment?: CommentView;
        message?: string;
      };
      if (!response.ok || !payload.comment) {
        setError(payload.message ?? 'That did not go through. Try again.');
        return;
      }

      const comment = payload.comment;
      setDraft('');
      // Placed straight at the top rather than refetching: a person should see
      // their own comment the instant it lands, whichever ordering is active.
      setPage((current) => ({
        ...current,
        comments: [comment, ...current.comments.filter((existing) => existing.id !== comment.id)],
        total: current.total + 1,
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

      const result = (await response.json()) as {
        likeCount: number;
        dislikeCount: number;
        viewerVote: VoteValue;
      };
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
    const response = await fetch(`/api/comments/${comment.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) return;
    setPage((current) => ({
      ...current,
      comments: current.comments.filter((item) => item.id !== comment.id),
      total: Math.max(0, current.total - 1),
    }));
  };

  const remaining = COMMENT_MAX_LENGTH - draft.length;
  const canPost = draft.trim().length >= 2 && !posting;

  return (
    <section aria-labelledby={headingId} className="paper p-[clamp(20px,2.6vw,40px)]">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <h2 id={headingId} className="display-sm m-0 flex items-center gap-3 text-[clamp(24px,2.8vw,40px)]">
          Discussion
          <span className="numeric bg-[color:var(--color-indigo)] px-[11px] py-[7px] text-[clamp(15px,1.4vw,20px)] font-extrabold leading-none text-paper">
            {formatCount(page.total)}
          </span>
        </h2>

        <div className="seg">
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

      <p className="m-0 mb-5 mt-3.5 max-w-[66ch] text-[14.5px] leading-[1.55] text-[rgb(23_20_15_/_0.68)]">
        Open to everyone with an account, whether or not you have reacted. Your eggs and medals are counted separately
        and are not affected by anything written here.
      </p>

      <form onSubmit={submit} className="border border-[var(--rule-default)]">
        <label htmlFor={fieldId} className="sr-only">
          Write a comment
        </label>
        <textarea
          id={fieldId}
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
          onFocus={() => {
            if (!isAuthenticated) requestSignIn();
          }}
          placeholder={
            isAuthenticated ? `Say what you think, ${viewerName ?? 'in your own words'}…` : 'Sign in to comment…'
          }
          className="block min-h-[clamp(110px,11vw,140px)] w-full resize-y border-0 bg-transparent p-4 text-[clamp(16px,1.25vw,19px)] leading-[1.5] text-ink outline-none placeholder:text-[rgb(23_20_15_/_0.45)]"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule-default)] px-3.5 py-3">
          <p className="m-0 text-[12.5px] font-medium leading-[1.4] text-[rgb(23_20_15_/_0.62)]">
            {draft.length === 0
              ? 'Be specific. Be fair. Be funnier than the last person.'
              : `${formatCount(remaining)} characters left`}
          </p>

          <button
            type="submit"
            disabled={!canPost}
            className={`btn min-h-11 flex-none px-[18px] py-3.5 text-[13.5px] font-extrabold tracking-[0.02em] ${
              canPost ? 'bg-egg text-ink' : 'bg-[rgb(23_20_15_/_0.1)] text-[rgb(23_20_15_/_0.6)]'
            }`}
          >
            {posting ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-bold text-[color:var(--color-egg-deep)]">
          {error}
        </p>
      )}

      {page.comments.length === 0 ? (
        <div className="mt-[22px] border-t border-[var(--rule-subtle)] pt-[22px]">
          <div className="display-sm text-[clamp(20px,2.2vw,30px)]">Nobody has said anything yet.</div>
          <p className="m-0 mt-2.5 max-w-[48ch] text-[14.5px] leading-[1.5] text-[rgb(23_20_15_/_0.66)]">
            {isAuthenticated
              ? 'The first comment sets the tone for this one.'
              : 'Sign in — the first comment sets the tone for this one.'}
          </p>
        </div>
      ) : (
        <ul className={`mt-[22px] flex flex-col transition-opacity duration-150 ${isPending ? 'opacity-60' : ''}`}>
          {page.comments.map((comment) => (
            <li key={comment.id} className="border-t border-[var(--rule-subtle)] py-[18px]">
              <Comment comment={comment} onVote={vote} onDelete={remove} />
            </li>
          ))}
        </ul>
      )}

      {page.nextOffset !== null && (
        <button type="button" onClick={() => void load(sort, page.nextOffset!)} className="btn btn-ink mt-4 px-4 py-3">
          Show more comments
        </button>
      )}
    </section>
  );
}

function Comment({
  comment,
  onVote,
  onDelete,
}: {
  comment: CommentView;
  onVote: (comment: CommentView, value: Exclude<VoteValue, 0>) => void;
  onDelete: (comment: CommentView) => void;
}) {
  return (
    <article>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-extrabold leading-none tracking-[0.02em]">{comment.author.displayName}</span>
        <StanceBadge stance={comment.authorStance} />
        <RelativeTime
          iso={comment.createdAt}
          className="text-[11.5px] font-medium uppercase leading-none tracking-[0.06em] text-[rgb(23_20_15_/_0.62)]"
        />

        <span className="ml-auto flex items-center gap-1.5">
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
          {comment.viewerCanDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment)}
              className="btn min-h-9 px-2 text-xs font-bold text-[rgb(23_20_15_/_0.62)] hover:text-ink"
            >
              Delete
            </button>
          )}
        </span>
      </div>

      <p className="m-0 max-w-[72ch] whitespace-pre-line text-pretty text-[15.5px] leading-[1.55]">{comment.body}</p>
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
      className={`btn btn-ink gap-1.5 ${active ? 'border-ink bg-ink text-paper' : ''}`}
    >
      <span aria-hidden="true" className={label === 'dislike' ? 'inline-block rotate-180' : 'inline-block'}>
        ▲
      </span>
      <span className="numeric">{formatCount(count)}</span>
    </button>
  );
}

/** The side this author took, when they took one. Square, never a dot. */
function StanceBadge({ stance }: { stance: CommentView['authorStance'] }) {
  if (!stance) {
    return (
      <span className="text-[10.5px] font-bold uppercase leading-none tracking-[0.06em] text-[rgb(23_20_15_/_0.45)]">
        No reaction
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
