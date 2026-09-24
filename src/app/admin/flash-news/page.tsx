import Link from 'next/link';
import type { Metadata } from 'next';
import { ContentTable, type ContentRow } from '@/components/admin/ContentTable';
import { AdminSearch } from '@/components/admin/AdminSearch';
import { listFlashNews, entitiesForFlashNewsBulk } from '@/lib/services/content';
import { getTotalsFor } from '@/lib/services/totals';
import { emptyTotals } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Admin · Stories' };
export const dynamic = 'force-dynamic';

export default async function AdminFlashNewsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  const items = await listFlashNews({ status: 'any', search: q ?? null, limit: 200 });
  const totals = await getTotalsFor(items.map((item) => ({ type: 'flash_news' as const, id: item.id })));
  const related = await entitiesForFlashNewsBulk(items.map((item) => item.id));

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
      meta: entities.length ? entities.map((entity) => entity.name).join(', ') : 'No related Entity',
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

      <ContentTable type="flash_news" rows={rows} editHrefPrefix="/admin/flash-news" publicHrefPrefix="/flash-news" />
    </div>
  );
}
