import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FlashNewsForm } from '@/components/admin/ContentForm';
import { StatusControls } from '@/components/admin/StatusControls';
import { DeleteArtifact } from '@/components/admin/DeleteArtifact';
import { countComments } from '@/lib/services/comments';
import { saveFlashNewsAction, type ActionResult } from '@/app/admin/actions';
import { getFlashNewsById, listEntities, entityIdsForFlashNews } from '@/lib/services/content';
import { getTotals } from '@/lib/services/totals';
import { formatCount } from '@/lib/domain/format';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

export const metadata: Metadata = { title: 'Admin · Edit Story' };
export const dynamic = 'force-dynamic';

export default async function EditFlashNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // One round of queries, not three: everything below only needs the id.
  const [item, entities, entityIds, totals, comments] = await Promise.all([
    getFlashNewsById(id),
    listEntities({ status: 'any', limit: 200 }),
    entityIdsForFlashNews(id),
    getTotals('flash_news', id),
    countComments('flash_news', id),
  ]);
  if (!item) notFound();

  async function action(previous: ActionResult, formData: FormData) {
    'use server';
    return saveFlashNewsAction(id, previous, formData);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Edit Story</h2>
          <p className="mt-1 text-sm text-secondary">
            {formatCount(totals.rottenEggTotal)} <EggIcon /> · {formatCount(totals.medalTotal)} <MedalIcon /> ·{' '}
            {formatCount(totals.negativeOpinionTotal)}/{formatCount(totals.positiveOpinionTotal)} opinions
          </p>
        </div>
        <StatusControls type="flash_news" id={item.id} status={item.status} />
      </div>

      <FlashNewsForm
        values={{
          id: item.id,
          headline: item.headline,
          slug: item.slug,
          summary: item.summary,
          body: item.body,
          category: item.category,
          imageUrl: item.imageUrl,
          sourceLabel: item.sourceLabel,
          sourceUrl: item.sourceUrl,
          details: item.details,
          status: item.status,
          entityIds,
        }}
        entities={entities.map((entity) => ({ id: entity.id, name: entity.name, category: entity.category }))}
        action={action}
      />

      <DeleteArtifact
        type="flash_news"
        id={item.id}
        slug={item.slug}
        title={item.headline}
        totals={totals}
        comments={comments}
      />
    </div>
  );
}
