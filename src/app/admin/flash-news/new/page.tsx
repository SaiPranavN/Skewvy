import type { Metadata } from 'next';
import { FlashNewsForm } from '@/components/admin/ContentForm';
import { saveFlashNewsAction, type ActionResult } from '@/app/admin/actions';
import { listEntities } from '@/lib/services/content';
import { CATEGORIES } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Admin · New Flash News' };
export const dynamic = 'force-dynamic';

export default async function NewFlashNewsPage() {
  const entities = await listEntities({ status: 'any', limit: 200 });

  async function action(previous: ActionResult, formData: FormData) {
    'use server';
    return saveFlashNewsAction(null, previous, formData);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-primary">New Flash News</h2>
        <p className="mt-1 text-sm text-secondary">
          A specific event, announcement, decision, release or achievement the crowd can react to.
        </p>
      </div>

      <FlashNewsForm
        values={{
          headline: '',
          slug: '',
          summary: '',
          body: '',
          category: CATEGORIES[0],
          imageUrl: null,
          sourceLabel: null,
          sourceUrl: null,
          status: 'draft',
          entityIds: [],
        }}
        entities={entities.map((entity) => ({ id: entity.id, name: entity.name, category: entity.category }))}
        action={action}
      />
    </div>
  );
}
