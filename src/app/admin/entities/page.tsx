import Link from 'next/link';
import type { Metadata } from 'next';
import { ContentTable, type ContentRow } from '@/components/admin/ContentTable';
import { AdminSearch } from '@/components/admin/AdminSearch';
import { listEntities, flashNewsCountsForEntities } from '@/lib/services/content';
import { getTotalsFor } from '@/lib/services/totals';
import { emptyTotals } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Admin · Profiles' };
export const dynamic = 'force-dynamic';

export default async function AdminEntitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  const entities = await listEntities({ status: 'any', search: q ?? null, limit: 200 });
  const [totals, counts] = await Promise.all([
    getTotalsFor(entities.map((entity) => ({ type: 'entity' as const, id: entity.id }))),
    flashNewsCountsForEntities(entities.map((entity) => entity.id)),
  ]);

  const rows: ContentRow[] = entities.map((entity) => ({
    id: entity.id,
    slug: entity.slug,
    title: entity.name,
    category: entity.category,
    imageUrl: entity.imageUrl,
    status: entity.status,
    totals: totals.get(`entity:${entity.id}`) ?? emptyTotals('entity', entity.id),
    meta: `${counts.get(entity.id) ?? 0} ${counts.get(entity.id) === 1 ? 'Story' : 'Stories'}`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-primary">
          Profiles <span className="text-tertiary">({rows.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch basePath="/admin/entities" initialValue={q ?? ''} />
          <Link
            href="/admin/entities/new"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
          >
            New Profile
          </Link>
        </div>
      </div>

      <ContentTable type="entity" rows={rows} editHrefPrefix="/admin/entities" publicHrefPrefix="/entities" />
    </div>
  );
}
