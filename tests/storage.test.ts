import { describe, it, expect, afterEach, vi } from 'vitest';
import { storageConfig, storageHostname, validateImage, uploadImage } from '@/lib/services/storage';
import { storageSetupSql, IMAGE_BUCKET, IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from '@/lib/db/schema';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const CONFIG = { url: 'https://hzyvbtocibpsnavvesop.supabase.co', secretKey: 'sb_secret_test' };

function imageFile(type: string, bytes = 32, name = 'photo'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('image validation', () => {
  it('accepts the formats the bucket allows', () => {
    for (const type of IMAGE_MIME_TYPES) {
      expect(validateImage(imageFile(type))).toMatchObject({ ok: true });
    }
  });

  it('refuses anything else', () => {
    expect(validateImage(imageFile('application/pdf'))).toMatchObject({ ok: false });
    expect(validateImage(imageFile('text/html'))).toMatchObject({ ok: false });
    // A disguised executable is still not an image.
    expect(validateImage(imageFile('application/octet-stream', 32, 'photo.png'))).toMatchObject({ ok: false });
  });

  it('refuses an empty or oversized file before anything is sent', () => {
    expect(validateImage(imageFile('image/png', 0))).toMatchObject({ ok: false });
    expect(validateImage(imageFile('image/png', IMAGE_MAX_BYTES + 1))).toMatchObject({ ok: false });
    expect(validateImage(imageFile('image/png', IMAGE_MAX_BYTES))).toMatchObject({ ok: true });
  });
});

describe('storage configuration', () => {
  it('is unconfigured unless both halves are present', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    expect(storageConfig()).toBeNull();

    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_x');
    expect(storageConfig()).toEqual({ url: 'https://project.supabase.co', secretKey: 'sb_secret_x' });
  });

  it('tolerates a trailing slash on the project url', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co/');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_x');
    expect(storageConfig()?.url).toBe('https://project.supabase.co');
  });

  it('reports the hostname the image optimiser has to allow', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    expect(storageHostname()).toBe('project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not a url');
    expect(storageHostname()).toBeNull();
  });
});

describe('uploading', () => {
  it('sends the file under a generated name and returns the public url', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadImage(imageFile('image/jpeg'), CONFIG);

    expect(result.ok).toBe(true);
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    // The uploader's filename is discarded: it is a path-traversal and
    // collision problem with nothing to recommend it.
    expect(endpoint).toMatch(
      new RegExp(`^${CONFIG.url}/storage/v1/object/${IMAGE_BUCKET}/[0-9a-f-]{36}\\.jpg$`),
    );
    expect(endpoint).not.toContain('photo');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${CONFIG.secretKey}`);
    expect((init.headers as Record<string, string>)['x-upsert']).toBe('false');
    expect((result as { url: string }).url).toContain(`/storage/v1/object/public/${IMAGE_BUCKET}/`);
  });

  it('never sends a file the bucket would reject', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await uploadImage(imageFile('application/pdf'), CONFIG)).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains a rejected key rather than leaking the response', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"message":"invalid jwt"}', { status: 403 }));
    const result = await uploadImage(imageFile('image/png'), CONFIG);
    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toContain('SUPABASE_SECRET_KEY');
  });

  it('points at the migration when the bucket is missing', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"message":"Bucket not found"}', { status: 404 }));
    const result = await uploadImage(imageFile('image/png'), CONFIG);
    expect((result as { message: string }).message).toContain('db:migrate');
  });

  it('survives the network being unreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    const result = await uploadImage(imageFile('image/png'), CONFIG);
    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toContain('ENOTFOUND');
  });
});

describe('bucket provisioning', () => {
  it('creates a public bucket carrying the same limits the code enforces', () => {
    const sql = storageSetupSql();
    expect(sql).toContain(`'${IMAGE_BUCKET}'`);
    expect(sql).toContain(String(IMAGE_MAX_BYTES));
    for (const type of IMAGE_MIME_TYPES) expect(sql).toContain(type);
  });

  it('is skipped on a PostgreSQL without Supabase Storage', () => {
    expect(storageSetupSql()).toContain("WHERE schema_name = 'storage'");
  });

  it('grants no write access to anon — the secret key is the only way in', () => {
    // Public read is the bucket flag; nothing here hands out an INSERT policy.
    const sql = storageSetupSql();
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/TO anon/i);
  });
});
