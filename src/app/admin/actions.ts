'use server';

import { revalidatePath } from 'next/cache';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin, getClientIp } from '@/lib/auth/current-user';
import { entityInputSchema, flashNewsInputSchema, contentStatusSchema } from '@/lib/validation/schemas';
import {
  createEntity,
  updateEntity,
  setEntityStatus,
  createFlashNews,
  updateFlashNews,
  setFlashNewsStatus,
  slugExists,
  slugify,
} from '@/lib/services/content';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { newId } from '@/lib/services/crypto';

/**
 * Admin mutations. Every one of these re-checks the admin flag on the server —
 * the UI hiding a control is never the authorisation.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
  redirectTo?: string;
}

async function guard(): Promise<ActionResult | null> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: 'Administrator access required.' };

  const ip = await getClientIp();
  const limit = await consumeRateLimit(`admin:${admin.id}:${ip ?? ''}`, RATE_RULES.adminWrite);
  if (!limit.allowed) return { ok: false, message: 'Slow down for a moment and try again.' };

  return null;
}

function readEntityForm(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  return {
    name,
    slug: String(formData.get('slug') ?? '').trim() || slugify(name),
    description: String(formData.get('description') ?? '').trim(),
    category: String(formData.get('category') ?? '').trim(),
    imageUrl: String(formData.get('imageUrl') ?? '').trim() || null,
    accent: String(formData.get('accent') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'draft'),
  };
}

export async function saveEntityAction(id: string | null, _previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = entityInputSchema.safeParse(readEntityForm(formData));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.') || 'form'] = issue.message;
    return { ok: false, message: 'Some fields need another look.', fields };
  }

  if (await slugExists('entities', parsed.data.slug, id ?? undefined)) {
    return { ok: false, message: 'That slug is already taken.', fields: { slug: 'Already in use.' } };
  }

  const entity = id ? await updateEntity(id, parsed.data) : await createEntity(parsed.data);
  if (!entity) return { ok: false, message: 'That Entity no longer exists.' };

  revalidatePath('/admin/entities');
  revalidatePath('/entities');
  revalidatePath(`/entities/${entity.slug}`);

  return { ok: true, message: id ? 'Entity saved.' : 'Entity created.', redirectTo: `/admin/entities/${entity.id}/edit` };
}

function readFlashNewsForm(formData: FormData) {
  const headline = String(formData.get('headline') ?? '').trim();
  return {
    headline,
    slug: String(formData.get('slug') ?? '').trim() || slugify(headline),
    summary: String(formData.get('summary') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    category: String(formData.get('category') ?? '').trim(),
    imageUrl: String(formData.get('imageUrl') ?? '').trim() || null,
    accent: String(formData.get('accent') ?? '').trim() || null,
    sourceLabel: String(formData.get('sourceLabel') ?? '').trim() || null,
    sourceUrl: String(formData.get('sourceUrl') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'draft'),
    entityIds: formData.getAll('entityIds').map(String).filter(Boolean),
  };
}

export async function saveFlashNewsAction(
  id: string | null,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = flashNewsInputSchema.safeParse(readFlashNewsForm(formData));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.') || 'form'] = issue.message;
    return { ok: false, message: 'Some fields need another look.', fields };
  }

  if (await slugExists('flash_news', parsed.data.slug, id ?? undefined)) {
    return { ok: false, message: 'That slug is already taken.', fields: { slug: 'Already in use.' } };
  }

  const item = id ? await updateFlashNews(id, parsed.data) : await createFlashNews(parsed.data);
  if (!item) return { ok: false, message: 'That Flash News item no longer exists.' };

  revalidatePath('/admin/flash-news');
  revalidatePath('/flash-news');
  revalidatePath(`/flash-news/${item.slug}`);

  return {
    ok: true,
    message: id ? 'Flash News saved.' : 'Flash News created.',
    redirectTo: `/admin/flash-news/${item.id}/edit`,
  };
}

export async function setStatusAction(
  type: 'entity' | 'flash_news',
  id: string,
  status: string,
): Promise<ActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = contentStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, message: 'Unknown status.' };

  if (type === 'entity') await setEntityStatus(id, parsed.data);
  else await setFlashNewsStatus(id, parsed.data);

  revalidatePath('/admin');
  revalidatePath('/admin/entities');
  revalidatePath('/admin/flash-news');
  revalidatePath('/entities');
  revalidatePath('/flash-news');
  revalidatePath('/');

  return { ok: true, message: `Marked as ${parsed.data}.` };
}

/**
 * Image upload. Files land in `public/uploads`, which works for local
 * development and any deployment with a writable disk. On a read-only or
 * serverless host, paste an external image URL instead.
 */
export async function uploadImageAction(_previous: ActionResult, formData: FormData): Promise<ActionResult & { url?: string }> {
  const blocked = await guard();
  if (blocked) return blocked;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose an image file first.' };
  }
  if (file.size > 6 * 1024 * 1024) {
    return { ok: false, message: 'Images must be 6 MB or smaller.' };
  }

  const allowed: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  };
  const extension = allowed[file.type];
  if (!extension) return { ok: false, message: 'Use a PNG, JPEG, WebP, AVIF or SVG image.' };

  const filename = `${newId()}.${extension}`;
  const directory = path.join(process.cwd(), 'public', 'uploads');

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, message: 'This deployment has a read-only filesystem. Paste an image URL instead.' };
  }

  return { ok: true, url: `/uploads/${filename}`, message: 'Image uploaded.' };
}
