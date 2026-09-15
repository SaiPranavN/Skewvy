import { newId } from './crypto';
import { IMAGE_BUCKET, IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from '@/lib/db/schema';

/**
 * Uploaded images, held in Supabase Storage.
 *
 * The rest of the application reaches Supabase over plain Postgres, but files
 * do not live in Postgres — Storage is an HTTP service in front of S3, so this
 * one path needs an API key. It is the secret key, used only here, only on the
 * server, and never sent to the browser: the alternative would be a Storage
 * policy granting writes to `anon`, which is the publishable key, which means
 * anyone at all.
 *
 * Kept to plain `fetch` rather than pulling in `@supabase/supabase-js` for a
 * single PUT.
 */

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

export interface StorageConfig {
  url: string;
  secretKey: string;
}

/** Storage is configured only when both halves are present. */
export function storageConfig(): StorageConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  return url && secretKey ? { url, secretKey } : null;
}

/** The public host images are served from, for the image optimiser's allowlist. */
export function storageHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Builds the auth headers Storage accepts.
 *
 * Supabase has two generations of key. The legacy `service_role` key is a JWT
 * and goes in `Authorization: Bearer`. The current `sb_secret_…` key is not a
 * JWT, and sending it as a Bearer token is rejected with "Invalid Compact JWS"
 * — it belongs in `apikey`, which both generations accept. So `apikey` is
 * always sent, and the Bearer header only when the key really is a JWT.
 */
export function authHeaders(secretKey: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: secretKey };
  if (secretKey.startsWith('eyJ')) headers.authorization = `Bearer ${secretKey}`;
  return headers;
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/**
 * Checks a file before any of it is sent anywhere.
 *
 * Storage enforces the same limits on arrival, but rejecting here means a 40 MB
 * file is never read into memory and never crosses the wire.
 */
export function validateImage(file: File): { ok: true; extension: string } | { ok: false; message: string } {
  if (file.size === 0) return { ok: false, message: 'That file is empty.' };
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, message: `Images must be ${Math.floor(IMAGE_MAX_BYTES / (1024 * 1024))} MB or smaller.` };
  }

  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension || !IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number])) {
    return { ok: false, message: 'Use a PNG, JPEG, WebP, AVIF or SVG image.' };
  }

  return { ok: true, extension };
}

/**
 * Sends one image to the bucket and returns the public URL.
 *
 * The name is generated rather than taken from the upload: a filename chosen by
 * the uploader is a path-traversal and collision problem, and it is the one
 * piece of an upload with no reason to be preserved.
 */
export async function uploadImage(file: File, config: StorageConfig): Promise<UploadResult> {
  const validated = validateImage(file);
  if (!validated.ok) return validated;

  const objectPath = `${newId()}.${validated.extension}`;
  const endpoint = `${config.url}/storage/v1/object/${IMAGE_BUCKET}/${objectPath}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...authHeaders(config.secretKey),
        'content-type': file.type,
        // Never overwrite: every upload gets a fresh name, so a collision here
        // would mean something has gone wrong rather than something benign.
        'x-upsert': 'false',
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body: file,
    });
  } catch (error) {
    return { ok: false, message: `Could not reach Supabase Storage: ${(error as Error).message}` };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { ok: false, message: storageErrorMessage(response.status, detail) };
  }

  return { ok: true, url: `${config.url}/storage/v1/object/public/${IMAGE_BUCKET}/${objectPath}` };
}

function storageErrorMessage(status: number, detail: string): string {
  if (status === 401 || status === 403) {
    return 'Supabase rejected the upload key. Check SUPABASE_SECRET_KEY.';
  }
  if (status === 400 && /compact jws/i.test(detail)) {
    return 'Supabase rejected the upload key format. Check SUPABASE_SECRET_KEY.';
  }
  if (status === 404) {
    return `The "${IMAGE_BUCKET}" bucket does not exist. Run npm run db:migrate.`;
  }
  if (status === 413) return 'That image is too large for the bucket.';

  const parsed = safeMessage(detail);
  return parsed ? `Upload failed: ${parsed}` : `Upload failed (${status}).`;
}

function safeMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? null;
  } catch {
    return body.slice(0, 200) || null;
  }
}
