import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EntityForm } from '@/components/admin/ContentForm';
import { StatusControls } from '@/components/admin/StatusControls';
import { DeleteArtifact } from '@/components/admin/DeleteArtifact';
import { countComments } from '@/lib/services/comments';
import { saveEntityAction, type ActionResult } from '@/app/admin/actions';
import { getEntityById } from '@/lib/services/content';
import { getTotals } from '@/lib/services/totals';
import { formatCount } from '@/lib/domain/format';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

export const metadata: Metadata = { title: 'Admin · Edit Profile' };
export const dynamic = 'force-dynamic';

export default async function EditEntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // One round of queries, not two: everything below only needs the id.
  const [entity, totals, comments] = await Promise.all([
    getEntityById(id),
    getTotals('entity', id),
    countComments('entity', id),
  ]);
  if (!entity) notFound();

  async function action(previous: ActionResult, formData: FormData) {
    'use server';
    return saveEntityAction(id, previous, formData);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Edit Profile</h2>
          <p className="mt-1 text-sm text-secondary">
            {formatCount(totals.rottenEggTotal)} <EggIcon /> · {formatCount(totals.medalTotal)} <MedalIcon /> ·{' '}
            {totals.uniqueParticipantTotal === 1 ? '1 person' : `${formatCount(totals.uniqueParticipantTotal)} people`}
          </p>
        </div>
        <StatusControls type="entity" id={entity.id} status={entity.status} />
      </div>

      <EntityForm
        values={{
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          description: entity.description,
          category: entity.category,
          imageUrl: entity.imageUrl,
          details: entity.details,
          status: entity.status,
        }}
        action={action}
      />

      <DeleteArtifact
        type="entity"
        id={entity.id}
        slug={entity.slug}
        title={entity.name}
        totals={totals}
        comments={comments}
      />
    </div>
  );
}
