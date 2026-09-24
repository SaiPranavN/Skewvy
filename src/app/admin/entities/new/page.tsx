import type { Metadata } from 'next';
import { EntityForm } from '@/components/admin/ContentForm';
import { saveEntityAction, type ActionResult } from '@/app/admin/actions';
import { ENTITY_CATEGORIES } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Admin · New Profile' };

export default function NewEntityPage() {
  async function action(previous: ActionResult, formData: FormData) {
    'use server';
    return saveEntityAction(null, previous, formData);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-primary">New Profile</h2>
        <p className="mt-1 text-sm text-secondary">
          A persistent subject that accumulates public sentiment over time — a company, club, studio, product or public
          body.
        </p>
      </div>

      <EntityForm
        values={{
          name: '',
          slug: '',
          description: '',
          category: ENTITY_CATEGORIES[0],
          imageUrl: null,
          status: 'draft',
        }}
        action={action}
      />
    </div>
  );
}
