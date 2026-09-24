import { query, queryOne, transaction } from '@/lib/db';
import { newId } from './crypto';
import type { ArtifactType, Stance } from '@/lib/domain/types';
import type { ReportReason } from '@/lib/domain/reports';

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
  /** The viewer wrote it. Nobody reports their own comment; they delete it. */
  viewerIsAuthor: boolean;
  /** The viewer has already flagged it for review. */
  viewerHasReported: boolean;
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
  viewer_report: string | null;
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
    viewerIsAuthor: viewerId !== null && viewerId === row.user_id,
    viewerHasReported: row.viewer_report !== null && row.viewer_report !== undefined,
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
            v.value  AS viewer_vote,
            r.id     AS viewer_report
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN opinions o
         ON o.user_id = c.user_id AND o.artifact_type = c.artifact_type AND o.artifact_id = c.artifact_id
       LEFT JOIN comment_votes v
         ON v.comment_id = c.id AND v.user_id = $3
       LEFT JOIN comment_reports r
         ON r.comment_id = c.id AND r.reporter_id = $3
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
            NULL AS viewer_vote,
            NULL AS viewer_report
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
  await transaction(async (tx) => {
    await tx.execute('UPDATE comments SET deleted_at = $2, updated_at = $2 WHERE id = $1', [input.commentId, now]);
    // A comment that is gone has nothing left to review.
    await tx.execute(
      `UPDATE comment_reports SET resolved_at = $2, resolution = 'removed', resolved_by = $3
        WHERE comment_id = $1 AND resolved_at IS NULL`,
      [input.commentId, now, input.userId],
    );
  });
  return 'deleted';
}

/* --------------------------------- reports --------------------------------- */

export type ReportOutcome = 'reported' | 'already_reported' | 'own_comment' | 'not_found';

/**
 * Flags a comment for an administrator to look at.
 *
 * A report changes nothing on its own: the comment stays up, its votes stay
 * where they are, and nobody else can see that it was reported. It only puts
 * the comment in the review queue. Hiding on a report count would hand every
 * pile-on a delete button.
 */
export async function reportComment(input: {
  userId: string;
  commentId: string;
  reason: ReportReason;
  details?: string | null;
}): Promise<ReportOutcome> {
  const comment = await queryOne<{ user_id: string }>(
    'SELECT user_id FROM comments WHERE id = $1 AND deleted_at IS NULL',
    [input.commentId],
  );
  if (!comment) return 'not_found';
  if (comment.user_id === input.userId) return 'own_comment';

  const details = input.details?.trim() || null;
  const inserted = await query<{ id: string }>(
    `INSERT INTO comment_reports (id, comment_id, reporter_id, reason, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (comment_id, reporter_id) DO NOTHING
     RETURNING id`,
    [newId(), input.commentId, input.userId, input.reason, details, new Date().toISOString()],
  );

  return inserted.length > 0 ? 'reported' : 'already_reported';
}

export interface ReportedComment {
  commentId: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string };
  artifact: { type: ArtifactType; id: string; slug: string | null; title: string | null };
  /** Open reports only. */
  reportCount: number;
  reasons: Array<{ reason: ReportReason; count: number }>;
  /** What reporters wrote, newest first. */
  notes: string[];
  firstReportedAt: string;
  lastReportedAt: string;
}

/**
 * The review queue: every comment with an open report, most-reported first.
 *
 * Reports are read as rows and folded here rather than grouped in SQL, so the
 * reasons and notes arrive together without a second query per comment.
 */
export async function listReportedComments(limit = 100): Promise<ReportedComment[]> {
  const rows = await query<{
    comment_id: string;
    body: string;
    comment_created_at: string;
    author_id: string;
    author_name: string;
    artifact_type: ArtifactType;
    artifact_id: string;
    slug: string | null;
    title: string | null;
    reason: ReportReason;
    details: string | null;
    reported_at: string;
  }>(
    `SELECT c.id AS comment_id, c.body, c.created_at AS comment_created_at,
            u.id AS author_id, u.display_name AS author_name,
            c.artifact_type, c.artifact_id,
            COALESCE(e.slug, f.slug) AS slug,
            COALESCE(e.name, f.headline) AS title,
            r.reason, r.details, r.created_at AS reported_at
       FROM comment_reports r
       JOIN comments c ON c.id = r.comment_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN entities e ON c.artifact_type = 'entity' AND e.id = c.artifact_id
       LEFT JOIN flash_news f ON c.artifact_type = 'flash_news' AND f.id = c.artifact_id
      WHERE r.resolved_at IS NULL AND c.deleted_at IS NULL
      ORDER BY r.created_at DESC`,
  );

  const byComment = new Map<string, ReportedComment>();
  for (const row of rows) {
    let entry = byComment.get(row.comment_id);
    if (!entry) {
      entry = {
        commentId: row.comment_id,
        body: row.body,
        createdAt: row.comment_created_at,
        author: { id: row.author_id, displayName: row.author_name },
        artifact: { type: row.artifact_type, id: row.artifact_id, slug: row.slug, title: row.title },
        reportCount: 0,
        reasons: [],
        notes: [],
        firstReportedAt: row.reported_at,
        lastReportedAt: row.reported_at,
      };
      byComment.set(row.comment_id, entry);
    }

    entry.reportCount += 1;
    const reason = entry.reasons.find((item) => item.reason === row.reason);
    if (reason) reason.count += 1;
    else entry.reasons.push({ reason: row.reason, count: 1 });
    if (row.details) entry.notes.push(row.details);
    // Rows arrive newest first, so each later row is an earlier report.
    entry.firstReportedAt = row.reported_at;
  }

  return [...byComment.values()]
    .map((entry) => ({ ...entry, reasons: entry.reasons.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.reportCount - a.reportCount || b.lastReportedAt.localeCompare(a.lastReportedAt))
    .slice(0, limit);
}

export async function countOpenReports(): Promise<number> {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT r.comment_id) AS total
       FROM comment_reports r
       JOIN comments c ON c.id = r.comment_id
      WHERE r.resolved_at IS NULL AND c.deleted_at IS NULL`,
  );
  return Number(row?.total ?? 0);
}

/**
 * Closes every open report on one comment, either by taking the comment down
 * or by deciding it can stay. Admin only; the caller checks.
 */
export async function resolveCommentReports(input: {
  commentId: string;
  adminId: string;
  action: 'remove' | 'dismiss';
}): Promise<'resolved' | 'not_found'> {
  const now = new Date().toISOString();

  return transaction(async (tx) => {
    const found = await tx.query<{ id: string }>('SELECT id FROM comments WHERE id = $1', [input.commentId]);
    if (found.length === 0) return 'not_found';

    if (input.action === 'remove') {
      await tx.execute(
        'UPDATE comments SET deleted_at = $2, updated_at = $2 WHERE id = $1 AND deleted_at IS NULL',
        [input.commentId, now],
      );
    }

    await tx.execute(
      `UPDATE comment_reports SET resolved_at = $2, resolution = $3, resolved_by = $4
        WHERE comment_id = $1 AND resolved_at IS NULL`,
      [input.commentId, now, input.action === 'remove' ? 'removed' : 'dismissed', input.adminId],
    );
    return 'resolved';
  });
}
