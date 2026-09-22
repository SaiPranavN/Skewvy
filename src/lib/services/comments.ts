import { query, queryOne, transaction } from '@/lib/db';
import { newId } from './crypto';
import type { ArtifactType, Stance } from '@/lib/domain/types';

/**
 * Open discussion attached to an artifact.
 *
 * Deliberately independent of the reaction machinery. Reacting takes a side and
 * that side is permanent; commenting does neither. Anyone signed in may post
 * here whether or not they have ever sent an Egg or a Medal, and a vote on a
 * comment can be changed or taken back — it says "useful" or "not", not
 * "critical" or "appreciative".
 *
 * Vote tallies are denormalised onto the comment row and moved in the same
 * transaction as the vote itself, so a list of fifty comments is one query
 * rather than fifty.
 */

export const COMMENT_PAGE_SIZE = 20;

export type CommentSort = 'new' | 'top';
/**
 * Which commenters to show, by the side they took on this artifact.
 *
 * `none` is a real category, not an absence: a person who has never reacted may
 * still have the most useful thing to say, and filtering them out of "all"
 * would quietly make commenting look like it required a stance.
 */
export type CommentStanceFilter = 'all' | 'positive' | 'negative';
/** 1 likes, -1 dislikes, 0 withdraws whatever was there. */
export type VoteValue = -1 | 0 | 1;

export interface CommentView {
  id: string;
  body: string;
  createdAt: string;
  likeCount: number;
  dislikeCount: number;
  author: { id: string; displayName: string };
  /** The side the author took on this artifact, if they ever reacted to it. */
  authorStance: Stance | null;
  /** The viewer's own vote on this comment. */
  viewerVote: VoteValue;
  /** True when the viewer may remove it: their own comment, or an admin. */
  viewerCanDelete: boolean;
}

export interface CommentPage {
  comments: CommentView[];
  /** How many comments the active filter matches. */
  total: number;
  /** How many the discussion holds in all, whatever the filter. */
  overallTotal: number;
  /** Offset to pass back for the next page, or null at the end. */
  nextOffset: number | null;
}

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  like_count: number;
  dislike_count: number;
  user_id: string;
  display_name: string;
  stance: string | null;
  viewer_vote: number | null;
}

function toView(row: CommentRow, viewerId: string | null, viewerIsAdmin: boolean): CommentView {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    likeCount: Number(row.like_count),
    dislikeCount: Number(row.dislike_count),
    author: { id: row.user_id, displayName: row.display_name },
    authorStance: (row.stance as Stance | null) ?? null,
    viewerVote: (Number(row.viewer_vote ?? 0) || 0) as VoteValue,
    viewerCanDelete: viewerIsAdmin || (viewerId !== null && viewerId === row.user_id),
  };
}

export async function listComments(
  artifactType: ArtifactType,
  artifactId: string,
  options: {
    viewerId?: string | null;
    viewerIsAdmin?: boolean;
    sort?: CommentSort;
    stance?: CommentStanceFilter;
    limit?: number;
    offset?: number;
  } = {},
): Promise<CommentPage> {
  const viewerId = options.viewerId ?? null;
  const viewerIsAdmin = options.viewerIsAdmin ?? false;
  const sort: CommentSort = options.sort === 'top' ? 'top' : 'new';
  const stance: CommentStanceFilter =
    options.stance === 'positive' || options.stance === 'negative' ? options.stance : 'all';
  const limit = Math.min(Math.max(options.limit ?? COMMENT_PAGE_SIZE, 1), 50);
  const offset = Math.max(options.offset ?? 0, 0);

  // Highest score first, then the newer of two equally rated comments.
  const order =
    sort === 'top' ? '(c.like_count - c.dislike_count) DESC, c.created_at DESC' : 'c.created_at DESC';

  // The filter reads the commenter's recorded side on *this* artifact, which is
  // what the join already supplies — not anything about what they wrote.
  const stanceClause = stance === 'all' ? '' : ' AND o.stance = $6';
  const stanceParams = stance === 'all' ? [] : [stance];

  const rows = await query<CommentRow>(
    `SELECT c.id, c.body, c.created_at, c.like_count, c.dislike_count, c.user_id,
            u.display_name,
            o.stance AS stance,
            v.value  AS viewer_vote
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN opinions o
         ON o.user_id = c.user_id AND o.artifact_type = c.artifact_type AND o.artifact_id = c.artifact_id
       LEFT JOIN comment_votes v
         ON v.comment_id = c.id AND v.user_id = $3
      WHERE c.artifact_type = $1 AND c.artifact_id = $2 AND c.deleted_at IS NULL${stanceClause}
      ORDER BY ${order}
      LIMIT $4 OFFSET $5`,
    [artifactType, artifactId, viewerId, limit, offset, ...stanceParams],
  );

  /*
   * Two counts, because they answer different questions: `total` is how many
   * comments the current filter has to page through, and `overallTotal` is how
   * many the discussion holds — the number in the heading, which must not jump
   * around as somebody flips between filters.
   */
  const filteredRow =
    stance === 'all'
      ? null
      : await queryOne<{ total: number }>(
          `SELECT COUNT(*) AS total
             FROM comments c
             LEFT JOIN opinions o
               ON o.user_id = c.user_id AND o.artifact_type = c.artifact_type AND o.artifact_id = c.artifact_id
            WHERE c.artifact_type = $1 AND c.artifact_id = $2 AND c.deleted_at IS NULL AND o.stance = $3`,
          [artifactType, artifactId, stance],
        );

  const overallRow = await queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM comments WHERE artifact_type = $1 AND artifact_id = $2 AND deleted_at IS NULL',
    [artifactType, artifactId],
  );

  const overallTotal = Number(overallRow?.total ?? 0);
  const total = filteredRow ? Number(filteredRow.total) : overallTotal;

  return {
    comments: rows.map((row) => toView(row, viewerId, viewerIsAdmin)),
    total,
    overallTotal,
    nextOffset: offset + rows.length < total ? offset + rows.length : null,
  };
}

export async function countComments(artifactType: ArtifactType, artifactId: string): Promise<number> {
  const row = await queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM comments WHERE artifact_type = $1 AND artifact_id = $2 AND deleted_at IS NULL',
    [artifactType, artifactId],
  );
  return Number(row?.total ?? 0);
}

export async function createComment(input: {
  userId: string;
  artifactType: ArtifactType;
  artifactId: string;
  body: string;
}): Promise<CommentView> {
  const now = new Date().toISOString();
  const id = newId();
  const body = input.body.trim();

  await transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO comments (id, artifact_type, artifact_id, user_id, body, like_count, dislike_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $6)`,
      [id, input.artifactType, input.artifactId, input.userId, body, now],
    );
  });

  const row = await queryOne<CommentRow>(
    `SELECT c.id, c.body, c.created_at, c.like_count, c.dislike_count, c.user_id,
            u.display_name,
            o.stance AS stance,
            NULL AS viewer_vote
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN opinions o
         ON o.user_id = c.user_id AND o.artifact_type = c.artifact_type AND o.artifact_id = c.artifact_id
      WHERE c.id = $1`,
    [id],
  );

  // The row was just written in this process; the read back cannot miss.
  return toView(row!, input.userId, false);
}

export interface VoteResult {
  likeCount: number;
  dislikeCount: number;
  viewerVote: VoteValue;
}

/**
 * Casts, switches or withdraws one person's vote on one comment.
 *
 * The tallies move by the difference between the old vote and the new one, in
 * the same transaction as the vote row, so they cannot drift apart under
 * concurrent voting.
 */
export async function voteOnComment(input: {
  userId: string;
  commentId: string;
  value: VoteValue;
}): Promise<VoteResult | null> {
  const now = new Date().toISOString();

  return transaction(async (tx) => {
    const comment = await tx.query<{ id: string }>(
      'SELECT id FROM comments WHERE id = $1 AND deleted_at IS NULL',
      [input.commentId],
    );
    if (comment.length === 0) return null;

    const existing = await tx.query<{ value: number }>(
      'SELECT value FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
      [input.commentId, input.userId],
    );
    const previous = (Number(existing[0]?.value ?? 0) || 0) as VoteValue;

    // Tapping the same button again withdraws the vote.
    const next: VoteValue = previous === input.value ? 0 : input.value;

    if (next === previous) {
      const unchanged = await tx.query<{ like_count: number; dislike_count: number }>(
        'SELECT like_count, dislike_count FROM comments WHERE id = $1',
        [input.commentId],
      );
      return {
        likeCount: Number(unchanged[0]?.like_count ?? 0),
        dislikeCount: Number(unchanged[0]?.dislike_count ?? 0),
        viewerVote: next,
      };
    }

    if (next === 0) {
      await tx.execute('DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2', [
        input.commentId,
        input.userId,
      ]);
    } else {
      await tx.execute(
        `INSERT INTO comment_votes (comment_id, user_id, value, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (comment_id, user_id) DO UPDATE SET value = $3, updated_at = $4`,
        [input.commentId, input.userId, next, now],
      );
    }

    const likeDelta = (next === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
    const dislikeDelta = (next === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);

    const updated = await tx.query<{ like_count: number; dislike_count: number }>(
      `UPDATE comments
          SET like_count = like_count + $2,
              dislike_count = dislike_count + $3,
              updated_at = $4
        WHERE id = $1
        RETURNING like_count, dislike_count`,
      [input.commentId, likeDelta, dislikeDelta, now],
    );

    return {
      likeCount: Number(updated[0]?.like_count ?? 0),
      dislikeCount: Number(updated[0]?.dislike_count ?? 0),
      viewerVote: next,
    };
  });
}

/** Soft delete, so vote rows and counts stay consistent. */
export async function deleteComment(input: {
  commentId: string;
  userId: string;
  isAdmin: boolean;
}): Promise<'deleted' | 'not_found' | 'forbidden'> {
  const row = await queryOne<{ user_id: string; deleted_at: string | null }>(
    'SELECT user_id, deleted_at FROM comments WHERE id = $1',
    [input.commentId],
  );
  if (!row || row.deleted_at) return 'not_found';
  if (!input.isAdmin && row.user_id !== input.userId) return 'forbidden';

  const now = new Date().toISOString();
  await query('UPDATE comments SET deleted_at = $2, updated_at = $2 WHERE id = $1', [input.commentId, now]);
  return 'deleted';
}
