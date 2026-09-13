import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  createTestFlashNews,
  createVerifiedUser,
} from './helpers';
import { createComment, listComments, voteOnComment, deleteComment } from '@/lib/services/comments';
import { applyReactionBatch } from '@/lib/services/reactions';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

describe('comments', () => {
  it('accepts a comment from someone who has never reacted', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    const comment = await createComment({
      userId,
      artifactType: 'flash_news',
      artifactId,
      body: 'No strong feelings, just watching this one.',
    });

    expect(comment.authorStance).toBeNull();
    expect(comment.likeCount).toBe(0);

    const page = await listComments('flash_news', artifactId, { viewerId: userId });
    expect(page.total).toBe(1);
    expect(page.comments[0].body).toBe('No strong feelings, just watching this one.');
  });

  it('reports the side the author took, without letting a comment change it', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'rotten_egg',
      quantity: 3,
      clientBatchId: 'batch-comment-1',
    });
    await createComment({ userId, artifactType: 'flash_news', artifactId, body: 'Still unhappy about this.' });

    const page = await listComments('flash_news', artifactId, { viewerId: userId });
    expect(page.comments[0].authorStance).toBe('negative');

    const { getTotals } = await import('@/lib/services/totals');
    const totals = await getTotals('flash_news', artifactId);
    expect(totals.negativeOpinionTotal).toBe(1);
    expect(totals.rottenEggTotal).toBe(3);
  });

  it('counts one vote per person and lets it be switched or withdrawn', async () => {
    const artifactId = await createTestFlashNews();
    const author = await createVerifiedUser('author@example.test');
    const voter = await createVerifiedUser('voter@example.test');

    const comment = await createComment({ userId: author, artifactType: 'flash_news', artifactId, body: 'A point.' });

    const liked = await voteOnComment({ userId: voter, commentId: comment.id, value: 1 });
    expect(liked).toMatchObject({ likeCount: 1, dislikeCount: 0, viewerVote: 1 });

    // Voting again the same way does not stack it.
    const repeated = await voteOnComment({ userId: voter, commentId: comment.id, value: 1 });
    expect(repeated).toMatchObject({ likeCount: 0, viewerVote: 0 });

    const disliked = await voteOnComment({ userId: voter, commentId: comment.id, value: -1 });
    expect(disliked).toMatchObject({ likeCount: 0, dislikeCount: 1, viewerVote: -1 });

    const switched = await voteOnComment({ userId: voter, commentId: comment.id, value: 1 });
    expect(switched).toMatchObject({ likeCount: 1, dislikeCount: 0, viewerVote: 1 });
  });

  it('keeps the denormalised tallies in step with the vote rows', async () => {
    const artifactId = await createTestFlashNews();
    const author = await createVerifiedUser('author2@example.test');
    const comment = await createComment({ userId: author, artifactType: 'flash_news', artifactId, body: 'Counted.' });

    for (let index = 0; index < 5; index += 1) {
      const voter = await createVerifiedUser(`voter-${index}@example.test`);
      await voteOnComment({ userId: voter, commentId: comment.id, value: index % 2 === 0 ? 1 : -1 });
    }

    const { query } = await import('@/lib/db');
    const rows = await query<{ value: number }>('SELECT value FROM comment_votes WHERE comment_id = $1', [comment.id]);
    const likes = rows.filter((row) => Number(row.value) === 1).length;
    const dislikes = rows.filter((row) => Number(row.value) === -1).length;

    const page = await listComments('flash_news', artifactId, {});
    expect(page.comments[0].likeCount).toBe(likes);
    expect(page.comments[0].dislikeCount).toBe(dislikes);
  });

  it('orders by score under the top sort and by recency under the new sort', async () => {
    const artifactId = await createTestFlashNews();
    const author = await createVerifiedUser('author3@example.test');
    const voter = await createVerifiedUser('voter3@example.test');

    const first = await createComment({ userId: author, artifactType: 'flash_news', artifactId, body: 'Older.' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createComment({ userId: author, artifactType: 'flash_news', artifactId, body: 'Newer.' });

    await voteOnComment({ userId: voter, commentId: first.id, value: 1 });

    const newest = await listComments('flash_news', artifactId, { sort: 'new' });
    expect(newest.comments[0].id).toBe(second.id);

    const top = await listComments('flash_news', artifactId, { sort: 'top' });
    expect(top.comments[0].id).toBe(first.id);
  });

  it('lets an author remove their own comment but not someone else’s', async () => {
    const artifactId = await createTestFlashNews();
    const author = await createVerifiedUser('author4@example.test');
    const other = await createVerifiedUser('other@example.test');

    const comment = await createComment({ userId: author, artifactType: 'flash_news', artifactId, body: 'Mine.' });

    expect(await deleteComment({ commentId: comment.id, userId: other, isAdmin: false })).toBe('forbidden');
    expect(await deleteComment({ commentId: comment.id, userId: other, isAdmin: true })).toBe('deleted');

    const page = await listComments('flash_news', artifactId, {});
    expect(page.total).toBe(0);
  });

  it('marks only the viewer’s own vote as theirs', async () => {
    const artifactId = await createTestFlashNews();
    const author = await createVerifiedUser('author5@example.test');
    const voter = await createVerifiedUser('voter5@example.test');
    const bystander = await createVerifiedUser('bystander@example.test');

    const comment = await createComment({ userId: author, artifactType: 'flash_news', artifactId, body: 'Rated.' });
    await voteOnComment({ userId: voter, commentId: comment.id, value: 1 });

    const asVoter = await listComments('flash_news', artifactId, { viewerId: voter });
    const asBystander = await listComments('flash_news', artifactId, { viewerId: bystander });
    const signedOut = await listComments('flash_news', artifactId, { viewerId: null });

    expect(asVoter.comments[0].viewerVote).toBe(1);
    expect(asBystander.comments[0].viewerVote).toBe(0);
    expect(signedOut.comments[0].viewerVote).toBe(0);
    expect(signedOut.comments[0].viewerCanDelete).toBe(false);
    expect(asVoter.comments[0].likeCount).toBe(1);
  });
});
