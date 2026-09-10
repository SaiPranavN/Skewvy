import type { Metadata } from 'next';
import { EntityForm } from '@/components/admin/ContentForm';
import { saveEntityAction, type ActionResult } from '@/app/admin/actions';
import { CATEGORIES } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Admin · New Entity' };

export default function NewEntityPage() {
  async function action(previous: ActionResult, formData: FormData) {
    'use server';
    return saveEntityAction(null, previous, formData);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-chalk">New Entity</h2>
        <p className="mt-1 text-sm text-haze">
          A persistent subject that accumulates public sentiment over time — a company, club, studio, product or public
          body.
        </p>
      </div>

      <EntityForm
        values={{
          name: '',
          slug: '',
          description: '',
          category: CATEGORIES[0],
          imageUrl: null,
          accent: '#e0483c',
          status: 'draft',
        }}
        action={action}
      />
    </div>
  );
}
