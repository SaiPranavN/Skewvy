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
} from '@/lib/services/content';
import { applyReactionBatch } from '@/lib/services/reactions';
import { searchArtifacts } from '@/lib/services/search';
import { leaderboard, trendingSections } from '@/lib/services/trending';

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

    // Every trending section must say what it counted — reactions, opinions,
    // people, or nothing at all.
    const sections = await trendingSections();
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.metricLabel).toMatch(/reaction|medal|rotten egg|opinion|newest|not ranked/i);
    }
  });
});

describe('slugs', () => {
  it('produces URL-safe slugs from headlines', () => {
    expect(slugify('Nimbus Fare adds a “seat selection” fee!')).toBe('nimbus-fare-adds-a-seat-selection-fee');
    expect(slugify('  Multiple   spaces  ')).toBe('multiple-spaces');
  });
});
