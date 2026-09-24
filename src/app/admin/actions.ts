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
import { storageConfig, uploadImage, validateImage } from '@/lib/services/storage';
import {
  suspendAccount,
  restoreAccount,
  deleteAccount,
  type AccountActionOutcome,
} from '@/lib/services/accounts';
import { resolveCommentReports } from '@/lib/services/comments';

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
  if (!entity) return { ok: false, message: 'That Profile no longer exists.' };

  revalidatePath('/admin/entities');
  revalidatePath('/entities');
  revalidatePath(`/entities/${entity.slug}`);

  return { ok: true, message: id ? 'Profile saved.' : 'Profile created.', redirectTo: `/admin/entities/${entity.id}/edit` };
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
  if (!item) return { ok: false, message: 'That Story no longer exists.' };

  revalidatePath('/admin/flash-news');
  revalidatePath('/flash-news');
  revalidatePath(`/flash-news/${item.slug}`);

  return {
    ok: true,
    message: id ? 'Story saved.' : 'Story created.',
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
 * Image upload.
 *
 * Files go to Supabase Storage. A local-disk fallback remains for development
 * without Supabase credentials, but it is refused in production: a serverless
 * filesystem is ephemeral, so writing there would appear to work and then lose
 * the image the moment the instance recycled.
 */
export async function uploadImageAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult & { url?: string }> {
  const blocked = await guard();
  if (blocked) return blocked;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose an image file first.' };
  }

  const validated = validateImage(file);
  if (!validated.ok) return { ok: false, message: validated.message };

  const config = storageConfig();
  if (config) {
    const result = await uploadImage(file, config);
    return result.ok
      ? { ok: true, url: result.url, message: 'Image uploaded.' }
      : { ok: false, message: result.message };
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      ok: false,
      message: 'Image storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.',
    };
  }

  const filename = `${newId()}.${validated.extension}`;
  const directory = path.join(process.cwd(), 'public', 'uploads');

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, message: 'Could not write the file locally. Configure Supabase Storage instead.' };
  }

  return { ok: true, url: `/uploads/${filename}`, message: 'Image uploaded to local disk (development only).' };
}

/* -------------------------------- accounts -------------------------------- */

/**
 * Account moderation.
 *
 * Suspension and deletion both refuse to touch an administrator or the person
 * performing the action. Locking yourself out of the admin area is a mistake
 * with no in-app remedy, and one admin quietly removing another is not a
 * decision this UI should make easy.
 */
export async function suspendAccountAction(userId: string, reason: string): Promise<ActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: 'Administrator access required.' };

  const outcome = await suspendAccount({ userId, actingAdminId: admin.id, reason });
  revalidatePath('/admin/accounts');
  return accountOutcome(outcome, 'Account suspended and signed out everywhere.');
}

export async function restoreAccountAction(userId: string): Promise<ActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const outcome = await restoreAccount(userId);
  revalidatePath('/admin/accounts');
  return accountOutcome(outcome, 'Account restored. They can sign in again.');
}

export async function deleteAccountAction(userId: string): Promise<ActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: 'Administrator access required.' };

  const outcome = await deleteAccount({ userId, actingAdminId: admin.id });
  revalidatePath('/admin/accounts');
  revalidatePath('/admin');
  revalidatePath('/');
  return accountOutcome(outcome, 'Account deleted. Public totals have been recalculated.');
}

function accountOutcome(outcome: AccountActionOutcome, success: string): ActionResult {
  switch (outcome) {
    case 'done':
      return { ok: true, message: success };
    case 'not_found':
      return { ok: false, message: 'That account no longer exists.' };
    case 'refused_self':
      return { ok: false, message: 'You cannot do that to your own account.' };
    case 'refused_admin':
      return { ok: false, message: 'Remove the administrator flag first — admins are protected here.' };
  }
}

/* --------------------------------- reports --------------------------------- */

/**
 * Closes the reports on one comment. Removing takes the comment down for
 * everyone; dismissing leaves it up and clears it from the queue.
 */
export async function resolveReportAction(commentId: string, action: 'remove' | 'dismiss'): Promise<ActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: 'Administrator access required.' };
  if (action !== 'remove' && action !== 'dismiss') return { ok: false, message: 'Unknown action.' };

  const outcome = await resolveCommentReports({ commentId, adminId: admin.id, action });
  if (outcome === 'not_found') return { ok: false, message: 'That comment no longer exists.' };

  revalidatePath('/admin/reports');
  revalidatePath('/admin');
  return {
    ok: true,
    message: action === 'remove' ? 'Comment removed and its reports closed.' : 'Reports dismissed. The comment stays up.',
  };
}
