import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, truncateAll, createVerifiedUser } from './helpers';
import {
  createEntity,
  createFlashNews,
  updateFlashNews,
  setFlashNewsStatus,
  listFlashNews,
  listEntities,
  getFlashNewsBySlug,
  entitiesForFlashNews,
  entityIdsForFlashNews,
  toCards,
  slugify,
  deleteArtifactPermanently,
} from '@/lib/services/content';
import { applyReactionBatch } from '@/lib/services/reactions';
import { searchArtifacts } from '@/lib/services/search';
import { leaderboard, rankedIndex, TRENDING_TABS, trendingTab } from '@/lib/services/trending';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

const entityInput = (name: string, slug: string) => ({
  name,
  slug,
  description: `About ${name}`,
  category: 'Business',
  imageUrl: null,
  accent: '#e0483c',
  status: 'published' as const,
});

const flashNewsInput = (headline: string, slug: string, entityIds: string[] = []) => ({
  headline,
  slug,
  summary: 'A short context sentence.',
  body: 'What happened, in full.',
  category: 'Business',
  imageUrl: null,
  accent: '#e0483c',
  sourceLabel: 'Company statement',
  sourceUrl: null,
  status: 'published' as const,
  entityIds,
});

describe('content publishing', () => {
  it('hides unpublished content from the public feed', async () => {
    const published = await createFlashNews(flashNewsInput('Published item', 'published-item'));
    await createFlashNews({ ...flashNewsInput('Draft item', 'draft-item'), status: 'draft' });

    const feed = await listFlashNews();
    expect(feed.map((item) => item.id)).toEqual([published.id]);

    expect(await getFlashNewsBySlug('draft-item')).toBeNull();
    expect(await getFlashNewsBySlug('draft-item', true)).not.toBeNull();
  });

  it('stamps published_at on first publish and keeps it afterwards', async () => {
    const item = await createFlashNews({ ...flashNewsInput('Later', 'later'), status: 'draft' });
    expect(item.publishedAt).toBeNull();

    await setFlashNewsStatus(item.id, 'published');
    const published = await getFlashNewsBySlug('later');
    expect(published?.publishedAt).not.toBeNull();

    await setFlashNewsStatus(item.id, 'draft');
    await setFlashNewsStatus(item.id, 'published');
    const republished = await getFlashNewsBySlug('later');
    expect(republished?.publishedAt).toBe(published?.publishedAt);
  });

  it('archived content disappears from the feed but keeps its counters', async () => {
    const item = await createFlashNews(flashNewsInput('Archive me', 'archive-me'));
    const userId = await createVerifiedUser();
    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId: item.id,
      reactionType: 'medal', quantity: 20, clientBatchId: 'archive-test-1',
    });

    await setFlashNewsStatus(item.id, 'archived');
    expect(await listFlashNews()).toHaveLength(0);

    const { getTotals } = await import('@/lib/services/totals');
    expect((await getTotals('flash_news', item.id)).medalTotal).toBe(20);
  });
});

describe('Flash News and Entity relationships', () => {
  it('supports one Entity, several Entities, or none', async () => {
    const alpha = await createEntity(entityInput('Alpha Co', 'alpha-co'));
    const beta = await createEntity(entityInput('Beta Club', 'beta-club'));

    const single = await createFlashNews(flashNewsInput('One entity', 'one-entity', [alpha.id]));
    const both = await createFlashNews(flashNewsInput('Two entities', 'two-entities', [alpha.id, beta.id]));
    const none = await createFlashNews(flashNewsInput('No entity', 'no-entity', []));

    expect(await entityIdsForFlashNews(single.id)).toEqual([alpha.id]);
    expect((await entitiesForFlashNews(both.id)).map((entity) => entity.slug).sort()).toEqual(['alpha-co', 'beta-club']);
    expect(await entitiesForFlashNews(none.id)).toHaveLength(0);
  });

  it('replaces the relationship set on update rather than appending', async () => {
    const alpha = await createEntity(entityInput('Alpha Co', 'alpha-co'));
    const beta = await createEntity(entityInput('Beta Club', 'beta-club'));
    const item = await createFlashNews(flashNewsInput('Switching', 'switching', [alpha.id]));

    await updateFlashNews(item.id, flashNewsInput('Switching', 'switching', [beta.id]));
    expect(await entityIdsForFlashNews(item.id)).toEqual([beta.id]);
  });

  it('filters the feed by related Entity', async () => {
    const alpha = await createEntity(entityInput('Alpha Co', 'alpha-co'));
    await createFlashNews(flashNewsInput('About alpha', 'about-alpha', [alpha.id]));
    await createFlashNews(flashNewsInput('About nothing', 'about-nothing', []));

    const filtered = await listFlashNews({ entityId: alpha.id });
    expect(filtered.map((item) => item.slug)).toEqual(['about-alpha']);
  });
});

describe('cards', () => {
  it('attaches totals and the viewer’s own contribution', async () => {
    const item = await createFlashNews(flashNewsInput('Card test', 'card-test'));
    const mine = await createVerifiedUser('mine@example.test');
    const theirs = await createVerifiedUser('theirs@example.test');

    await applyReactionBatch({
      userId: mine, artifactType: 'flash_news', artifactId: item.id,
      reactionType: 'rotten_egg', quantity: 11, clientBatchId: 'card-mine-1',
    });
    await applyReactionBatch({
      userId: theirs, artifactType: 'flash_news', artifactId: item.id,
      reactionType: 'rotten_egg', quantity: 89, clientBatchId: 'card-theirs-1',
    });

    const [card] = await toCards({ flashNews: [item] }, { viewerId: mine });
    expect(card.totals.rottenEggTotal).toBe(100);
    expect(card.contribution?.rottenEggCount).toBe(11);
    expect(card.totals.uniqueParticipantTotal).toBe(2);
  });

  it('omits the contribution for an anonymous viewer', async () => {
    const item = await createFlashNews(flashNewsInput('Anon', 'anon'));
    const [card] = await toCards({ flashNews: [item] });
    expect(card.contribution).toBeNull();
  });
});

describe('search', () => {
  it('finds Entities and Flash News, case-insensitively', async () => {
    await createEntity(entityInput('Nimbus Fare', 'nimbus-fare'));
    await createFlashNews(flashNewsInput('Nimbus Fare adds a fee', 'nimbus-fee'));

    const results = await searchArtifacts('nimbus');
    expect(results.entities).toHaveLength(1);
    expect(results.flashNews).toHaveLength(1);
    expect(results.total).toBe(2);
  });

  it('returns nothing for an empty query rather than everything', async () => {
    await createEntity(entityInput('Nimbus Fare', 'nimbus-fare'));
    const results = await searchArtifacts('   ');
    expect(results.total).toBe(0);
  });
});

describe('trending', () => {
  it('ranks by recent reaction velocity and labels what it measured', async () => {
    const quiet = await createFlashNews(flashNewsInput('Quiet item', 'quiet-item'));
    const loud = await createFlashNews(flashNewsInput('Loud item', 'loud-item'));
    const userId = await createVerifiedUser();

    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId: quiet.id,
      reactionType: 'rotten_egg', quantity: 5, clientBatchId: 'trend-quiet-1',
    });
    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId: loud.id,
      reactionType: 'rotten_egg', quantity: 200, clientBatchId: 'trend-loud-1',
    });

    const board = await leaderboard('heat');
    expect(board[0].card.id).toBe(loud.id);
    expect(board[0].recentChange).toBe(200);

    // Every tab must state what it counted, so no ranking is ambiguous.
    for (const tab of TRENDING_TABS) {
      expect(tab.metricLabel).toMatch(/reaction|medal|rotten egg|opinion|lifetime/i);
    }

    const index = await rankedIndex('rotten_egg');
    expect(index[0].card.id).toBe(loud.id);
    expect(index[0].recentChange).toBe(200);
    // The opposing total travels with the row for context. The loud item
    // received only Rotten Eggs, so its Medal column is zero.
    expect(index[0].primaryCount).toBe(200);
    expect(index[0].secondaryCount).toBe(0);

    // An unknown tab falls back to overall activity rather than throwing.
    expect(trendingTab('nonsense').id).toBe('activity');
  });
});

describe('slugs', () => {
  it('produces URL-safe slugs from headlines', () => {
    expect(slugify('Nimbus Fare adds a “seat selection” fee!')).toBe('nimbus-fare-adds-a-seat-selection-fee');
    expect(slugify('  Multiple   spaces  ')).toBe('multiple-spaces');
  });
});

describe('details about a subject', () => {
  it('stores them in order and hands them to the card', async () => {
    const entity = await createEntity({
      ...entityInput('Smriti Mandhana', 'smriti-mandhana'),
      details: [
        { label: 'Profession', value: 'Cricketer' },
        { label: 'Country', value: 'India' },
        { label: 'Reference', value: 'https://example.test/profile' },
      ],
    });

    expect(entity.details.map((detail) => detail.label)).toEqual(['Profession', 'Country', 'Reference']);

    const [card] = await toCards({ entities: [entity] });
    expect(card.details).toHaveLength(3);
  });

  it('treats a profile saved before details existed as having none', async () => {
    const entity = await createEntity(entityInput('Older Co', 'older-co'));
    expect(entity.details).toEqual([]);
  });
});

describe('deleting an artifact permanently', () => {
  it('removes the item and everything recorded against it, and nothing else', async () => {
    const userId = await createVerifiedUser();
    const doomed = await createEntity(entityInput('Doomed Co', 'doomed-co'));
    const kept = await createEntity(entityInput('Kept Co', 'kept-co'));
    const story = await createFlashNews(flashNewsInput('About both', 'about-both', [doomed.id, kept.id]));

    for (const [id, batch] of [[doomed.id, 'doomed-batch'], [kept.id, 'kept-batch']] as const) {
      await applyReactionBatch({
        userId, artifactType: 'entity', artifactId: id,
        reactionType: 'medal', quantity: 5, clientBatchId: batch,
      });
    }
    const { createComment, reportComment } = await import('@/lib/services/comments');
    const other = await createVerifiedUser('other@example.test');
    const comment = await createComment({ userId, artifactType: 'entity', artifactId: doomed.id, body: 'Going away.' });
    await reportComment({ userId: other, commentId: comment.id, reason: 'spam' });

    const outcome = await deleteArtifactPermanently('entity', doomed.id);
    expect(outcome).toEqual({ deleted: true, slug: 'doomed-co' });

    const { query } = await import('@/lib/db');
    for (const table of ['opinions', 'reaction_aggregates', 'reaction_batches', 'reaction_timeline', 'opinion_timeline', 'artifact_totals', 'comments']) {
      const rows = await query(`SELECT 1 FROM ${table} WHERE artifact_id = $1`, [doomed.id]);
      expect(rows, table).toHaveLength(0);
    }
    expect(await query('SELECT 1 FROM comment_reports')).toHaveLength(0);
    expect(await query('SELECT 1 FROM entities WHERE id = $1', [doomed.id])).toHaveLength(0);

    // The story survives, now linked only to the profile that is still here.
    expect(await entityIdsForFlashNews(story.id)).toEqual([kept.id]);
    const { getTotals } = await import('@/lib/services/totals');
    expect((await getTotals('entity', kept.id)).medalTotal).toBe(5);
  });

  it('reports a missing item rather than pretending', async () => {
    expect(await deleteArtifactPermanently('flash_news', 'no-such-id')).toEqual({ deleted: false, slug: null });
  });
});

describe('the lead story setting', () => {
  it('stores a pin, replaces it, and clears it', async () => {
    const { getLeadStoryId, setLeadStoryId } = await import('@/lib/services/settings');
    expect(await getLeadStoryId()).toBeNull();

    await setLeadStoryId('story-a');
    await setLeadStoryId('story-b');
    expect(await getLeadStoryId()).toBe('story-b');

    await setLeadStoryId(null);
    expect(await getLeadStoryId()).toBeNull();
  });
});
