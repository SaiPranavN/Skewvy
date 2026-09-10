import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EntityForm } from '@/components/admin/ContentForm';
import { StatusControls } from '@/components/admin/StatusControls';
import { saveEntityAction, type ActionResult } from '@/app/admin/actions';
import { getEntityById } from '@/lib/services/content';
import { getTotals } from '@/lib/services/totals';
import { formatCount } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Admin · Edit Entity' };
export const dynamic = 'force-dynamic';

export default async function EditEntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entity = await getEntityById(id);
  if (!entity) notFound();

  const totals = await getTotals('entity', entity.id);

  async function action(previous: ActionResult, formData: FormData) {
    'use server';
    return saveEntityAction(id, previous, formData);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-chalk">Edit Entity</h2>
          <p className="mt-1 text-sm text-haze">
            {formatCount(totals.rottenEggTotal)} 🥚 · {formatCount(totals.medalTotal)} 🏅 ·{' '}
            {formatCount(totals.uniqueParticipantTotal)} people
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
          accent: entity.accent,
          status: entity.status,
        }}
        action={action}
      />
    </div>
  );
}
