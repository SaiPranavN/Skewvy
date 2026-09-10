import Link from 'next/link';
import type { Metadata } from 'next';
import { ContentTable, type ContentRow } from '@/components/admin/ContentTable';
import { AdminSearch } from '@/components/admin/AdminSearch';
import { listEntities, flashNewsCountsForEntities } from '@/lib/services/content';
import { getTotalsFor } from '@/lib/services/totals';
import { emptyTotals } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Admin · Entities' };
export const dynamic = 'force-dynamic';

export default async function AdminEntitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  const entities = await listEntities({ status: 'any', search: q ?? null, limit: 200 });
  const totals = await getTotalsFor(entities.map((entity) => ({ type: 'entity' as const, id: entity.id })));
  const counts = await flashNewsCountsForEntities(entities.map((entity) => entity.id));

  const rows: ContentRow[] = entities.map((entity) => ({
    id: entity.id,
    slug: entity.slug,
    title: entity.name,
    category: entity.category,
    imageUrl: entity.imageUrl,
    status: entity.status,
    totals: totals.get(`entity:${entity.id}`) ?? emptyTotals('entity', entity.id),
    meta: `${counts.get(entity.id) ?? 0} Flash News`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-chalk">
          Entities <span className="text-haze-dim">({rows.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch basePath="/admin/entities" initialValue={q ?? ''} />
          <Link
            href="/admin/entities/new"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
          >
            New Entity
          </Link>
        </div>
      </div>

      <ContentTable type="entity" rows={rows} editHrefPrefix="/admin/entities" publicHrefPrefix="/entities" />
    </div>
  );
}
