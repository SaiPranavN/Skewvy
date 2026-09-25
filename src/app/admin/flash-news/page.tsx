import Link from 'next/link';
import type { Metadata } from 'next';
import { ContentTable, type ContentRow } from '@/components/admin/ContentTable';
import { AdminSearch } from '@/components/admin/AdminSearch';
import { listFlashNews, entitiesForFlashNewsBulk } from '@/lib/services/content';
import { getTotalsFor } from '@/lib/services/totals';
import { emptyTotals } from '@/lib/domain/types';
import { getLeadStoryId } from '@/lib/services/settings';

export const metadata: Metadata = { title: 'Admin · Stories' };
export const dynamic = 'force-dynamic';

export default async function AdminFlashNewsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  const [items, leadId] = await Promise.all([
    listFlashNews({ status: 'any', search: q ?? null, limit: 200 }),
    getLeadStoryId(),
  ]);
  const ids = items.map((item) => item.id);
  const [totals, related] = await Promise.all([
    getTotalsFor(ids.map((id) => ({ type: 'flash_news' as const, id }))),
    entitiesForFlashNewsBulk(ids),
  ]);

  // What the Stories page will actually lead with: the pin while it is
  // published, otherwise the newest published Story.
  const pinned = items.find((item) => item.id === leadId && item.status === 'published') ?? null;
  const newest = items
    .filter((item) => item.status === 'published')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0];
  const effectiveLead = pinned ?? newest ?? null;

  const rows: ContentRow[] = items.map((item) => {
    const entities = related.get(item.id) ?? [];
    return {
      id: item.id,
      slug: item.slug,
      title: item.headline,
      category: item.category,
      imageUrl: item.imageUrl,
      status: item.status,
      totals: totals.get(`flash_news:${item.id}`) ?? emptyTotals('flash_news', item.id),
      meta: entities.length ? entities.map((entity) => entity.name).join(', ') : 'No related Profile',
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-primary">
          Stories <span className="text-tertiary">({rows.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch basePath="/admin/flash-news" initialValue={q ?? ''} />
          <Link
            href="/admin/flash-news/new"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
          >
            New Story
          </Link>
        </div>
      </div>

      <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-surface px-4 py-3 text-sm leading-relaxed text-secondary">
        <span className="font-semibold text-primary">Lead story: </span>
        {effectiveLead ? (
          <>
            {effectiveLead.headline}{' '}
            <span className="text-tertiary">
              — {pinned ? 'pinned by an editor' : 'automatic: the newest published Story'}
            </span>
          </>
        ) : (
          'none yet — publish a Story first.'
        )}
        <span className="mt-1 block text-xs text-tertiary">
          Use “Make lead story” on any published Story to pin it at the top of the Stories page.
        </span>
      </div>

      <ContentTable
        type="flash_news"
        rows={rows}
        editHrefPrefix="/admin/flash-news"
        publicHrefPrefix="/flash-news"
        leadId={pinned?.id ?? null}
      />
    </div>
  );
}
