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
      setPage((current) =>
        offset === 0 ? next : { ...next, comments: [...current.comments, ...next.comments] },
      );
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

      const payload = (await response.json()) as { comment?: CommentView; message?: string };
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
    if (!response.ok) return;
    setPage((current) => ({
      ...current,
      comments: current.comments.filter((item) => item.id !== comment.id),
      total: Math.max(0, current.total - 1),
    }));
  };

  const remaining = COMMENT_MAX_LENGTH - draft.length;

  return (
    <section aria-labelledby={headingId} className="divider pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-sm font-medium text-primary">
          Discussion{' '}
          <span className="numeric ml-1 text-tertiary">{formatCount(page.total)}</span>
        </h2>

        <div className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] p-0.5">
          {(['new', 'top'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeSort(option)}
              aria-pressed={sort === option}
              className={`min-h-8 rounded-full px-3 text-xs transition-colors duration-150 ${
                sort === option ? 'bg-surface-2 text-primary' : 'text-tertiary hover:text-secondary'
              }`}
            >
              {option === 'new' ? 'Newest' : 'Top rated'}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-tertiary">
        Open to everyone with an account, whether or not you have reacted. Your Eggs and Medals are counted separately
        and are not affected by anything written here.
      </p>

      <form onSubmit={submit} className="mt-4">
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
          rows={3}
          placeholder={isAuthenticated ? `Say what you think, ${viewerName ?? 'in your own words'}…` : 'Sign in to comment…'}
          className="w-full resize-y rounded-[var(--radius-control)] border border-[var(--border-default)] bg-surface px-3.5 py-3 text-sm leading-relaxed text-primary placeholder:text-disabled focus:border-[var(--border-strong)] focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-xs ${remaining < 60 ? 'text-secondary' : 'text-tertiary'}`}>
            {draft.length === 0 ? 'Be specific. Be fair.' : `${remaining} characters left`}
          </p>

          <button
            type="submit"
            disabled={posting || draft.trim().length < 2}
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {posting ? 'Posting…' : 'Post comment'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-xs text-error">
            {error}
          </p>
        )}
      </form>

      {page.comments.length === 0 ? (
        <p className="mt-6 text-sm text-tertiary">
          No comments yet. {isAuthenticated ? 'Write the first one.' : 'Sign in to write the first one.'}
        </p>
      ) : (
        <ul className={`mt-6 space-y-1 transition-opacity duration-150 ${isPending ? 'opacity-60' : ''}`}>
          {page.comments.map((comment) => (
            <li key={comment.id} className="border-t border-[var(--border-subtle)] py-4 first:border-t-0 first:pt-0">
              <Comment comment={comment} onVote={vote} onDelete={remove} />
            </li>
          ))}
        </ul>
      )}

      {page.nextOffset !== null && (
        <button
          type="button"
          onClick={() => void load(sort, page.nextOffset!)}
          className="mt-4 inline-flex min-h-10 items-center rounded-md border border-[var(--border-default)] px-4 text-sm text-secondary transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-primary"
        >
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
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
        <span className="text-sm font-medium text-primary">{comment.author.displayName}</span>
        <StanceBadge stance={comment.authorStance} />
        <RelativeTime iso={comment.createdAt} className="text-tertiary" />
      </div>

      <p className="mt-2 whitespace-pre-line text-[0.9375rem] leading-relaxed text-secondary">{comment.body}</p>

      <div className="mt-2.5 flex items-center gap-1">
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
            className="ml-2 min-h-8 rounded-md px-2 text-xs text-tertiary transition-colors duration-150 hover:text-primary"
          >
            Delete
          </button>
        )}
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
        active ? `Remove your ${label} — ${count} so far` : `${label === 'like' ? 'Like' : 'Dislike'} this comment — ${count} so far`
      }
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs transition-colors duration-150 ${
        active
          ? 'bg-surface-2 text-primary'
          : 'text-tertiary hover:bg-surface-2 hover:text-secondary'
      }`}
    >
      <ThumbIcon down={label === 'dislike'} filled={active} />
      <span className="numeric">{formatCount(count)}</span>
    </button>
  );
}

function StanceBadge({ stance }: { stance: CommentView['authorStance'] }) {
  if (!stance) {
    return <span className="text-tertiary">No reaction recorded</span>;
  }

  const negative = stance === 'negative';
  return (
    <span className={`flex items-center gap-1.5 ${negative ? 'text-egg' : 'text-medal'}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${negative ? 'bg-egg' : 'bg-medal'}`} />
      {negative ? 'Reacted critically' : 'Reacted appreciatively'}
    </span>
  );
}

function ThumbIcon({ down, filled }: { down: boolean; filled: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={down ? 'rotate-180' : undefined}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    >
      <path d="M5.5 14V6.6l3-4.6c.9 0 1.6.8 1.5 1.7L9.7 6h3.5c.9 0 1.6.9 1.4 1.8l-1 5c-.1.7-.7 1.2-1.4 1.2H5.5Z" />
      <path d="M5.5 6.6H2.4c-.5 0-.9.4-.9.9v5.6c0 .5.4.9.9.9h3.1" />
    </svg>
  );
}
