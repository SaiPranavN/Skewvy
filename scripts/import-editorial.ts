/**
 * Imports an editorial snapshot of Profiles and Stories from JSON.
 *
 *   npm run content:import -- path/to/file.json [--status archived] [--dry-run]
 *
 * Everything lands with the status given here (archived by default), whatever
 * the file says, so nothing goes public until an editor publishes it. A slug
 * that already exists is skipped rather than overwritten, which makes the
 * import safe to run twice. Every row is checked against the same rules as the
 * admin form before anything is written.
 */
import { readFile } from 'node:fs/promises';
import { createEntity, createFlashNews, slugExists } from '@/lib/services/content';
import { entityInputSchema, flashNewsInputSchema, contentStatusSchema } from '@/lib/validation/schemas';
import { ENTITY_CATEGORIES, FLASH_NEWS_CATEGORIES } from '@/lib/domain/types';
import { detailsFromObject } from '@/lib/domain/details';
import { query, getDb } from '@/lib/db';

interface SeedProfile {
  name: string;
  slug: string;
  short_description?: string;
  category: string;
  cover_image?: string;
  metadata?: Record<string, unknown>;
}

interface SeedStory {
  headline: string;
  slug: string;
  short_context_sentence?: string;
  body?: string;
  category: string;
  source_context_label?: string;
  source_url?: string;
  cover_image?: string;
  related_profiles?: string[];
}

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const statusArg = args[args.indexOf('--status') + 1];
const status = contentStatusSchema.parse(args.includes('--status') ? statusArg : 'archived');

if (!file) {
  console.error('Usage: npm run content:import -- <file.json> [--status archived|draft|published] [--dry-run]');
  process.exit(1);
}

const data = JSON.parse(await readFile(file, 'utf8')) as { profiles?: SeedProfile[]; stories?: SeedStory[] };
const profiles = data.profiles ?? [];
const stories = data.stories ?? [];
const db = await getDb();

console.info(`${dryRun ? 'Checking' : 'Importing'} ${profiles.length} profiles and ${stories.length} stories into ${db.dialect} as "${status}".`);

const problems: string[] = [];
const created = { profiles: 0, stories: 0 };
const skipped: string[] = [];

/* -------------------------------- profiles -------------------------------- */

for (const profile of profiles) {
  if (!(ENTITY_CATEGORIES as readonly string[]).includes(profile.category)) {
    problems.push(`profile ${profile.slug}: unknown category "${profile.category}"`);
    continue;
  }

  const parsed = entityInputSchema.safeParse({
    name: profile.name,
    slug: profile.slug,
    description: profile.short_description ?? '',
    category: profile.category,
    imageUrl: profile.cover_image?.trim() || null,
    details: detailsFromObject(profile.metadata),
    status,
  });
  if (!parsed.success) {
    problems.push(`profile ${profile.slug}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
    continue;
  }

  if (await slugExists('entities', parsed.data.slug)) {
    skipped.push(`profile ${parsed.data.slug}`);
    continue;
  }

  if (!dryRun) await createEntity(parsed.data);
  created.profiles += 1;
}

/* --------------------------------- stories -------------------------------- */

// Related profiles are named by slug; resolve against everything now stored,
// including profiles this run just created.
const entityRows = await query<{ id: string; slug: string }>('SELECT id, slug FROM entities');
const entityBySlug = new Map(entityRows.map((row) => [row.slug, row.id]));
const importedSlugs = new Set(profiles.map((profile) => profile.slug));

for (const story of stories) {
  if (!(FLASH_NEWS_CATEGORIES as readonly string[]).includes(story.category)) {
    problems.push(`story ${story.slug}: unknown category "${story.category}"`);
    continue;
  }

  const entityIds: string[] = [];
  for (const slug of story.related_profiles ?? []) {
    const id = entityBySlug.get(slug);
    if (id) entityIds.push(id);
    else if (!(dryRun && importedSlugs.has(slug))) problems.push(`story ${story.slug}: related profile "${slug}" not found`);
  }

  const parsed = flashNewsInputSchema.safeParse({
    headline: story.headline,
    slug: story.slug,
    summary: story.short_context_sentence ?? '',
    body: story.body ?? '',
    category: story.category,
    imageUrl: story.cover_image?.trim() || null,
    sourceLabel: story.source_context_label?.trim() || null,
    sourceUrl: story.source_url?.trim() || null,
    details: [],
    status,
    entityIds,
  });
  if (!parsed.success) {
    problems.push(`story ${story.slug}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
    continue;
  }

  if (await slugExists('flash_news', parsed.data.slug)) {
    skipped.push(`story ${parsed.data.slug}`);
    continue;
  }

  if (!dryRun) await createFlashNews(parsed.data);
  created.stories += 1;
}

console.info(`${dryRun ? 'Would create' : 'Created'} ${created.profiles} profiles and ${created.stories} stories.`);
if (skipped.length > 0) console.info(`Skipped (slug already exists): ${skipped.join(', ')}`);
if (problems.length > 0) {
  console.warn(`Problems (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
}
process.exit();
