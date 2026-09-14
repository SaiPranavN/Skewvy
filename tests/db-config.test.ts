import { describe, it, expect, afterEach, vi } from 'vitest';
import { schemaTables, postgresHardeningSql, schemaStatements } from '@/lib/db/schema';
import { resolveSsl, isPooledConnection, isTransactionPooler, withoutSslMode } from '@/lib/db/postgres';
import { resolveUrl, isPostgresUrl } from '@/lib/db';
import { migrationFileContents, MIGRATION_PATH } from '@/lib/db/migration-file';
import { readFileSync } from 'node:fs';

afterEach(() => {
  vi.unstubAllEnvs();
});

const SUPABASE_TRANSACTION =
  'postgresql://postgres.hzyvbtocibpsnavvesop:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const SUPABASE_SESSION =
  'postgresql://postgres.hzyvbtocibpsnavvesop:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

describe('Supabase API exposure', () => {
  /*
   * The guard that matters most on Supabase: every table in the public schema
   * is reachable through PostgREST with a key that ships in the browser. A new
   * table left out of the hardening block is a public table.
   */
  it('locks down every table the schema creates', () => {
    const sql = postgresHardeningSql();
    const tables = schemaTables();

    expect(tables.length).toBeGreaterThan(10);
    for (const table of tables) {
      expect(sql).toContain(`'${table}'`);
    }
  });

  it('enables row-level security and revokes the anon grants', () => {
    const sql = postgresHardeningSql();
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON public.%I FROM anon, authenticated');
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES');
  });

  it('leaves a plain PostgreSQL database alone when the Supabase roles are absent', () => {
    // The revokes are guarded so the migration does not fail on a database
    // that has never heard of `anon`.
    expect(postgresHardeningSql()).toContain("EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')");
  });

  it('names the tables the schema actually declares', () => {
    const tables = schemaTables();
    expect(tables).toContain('users');
    expect(tables).toContain('sessions');
    expect(tables).toContain('comments');
    expect(tables).toContain('reaction_timeline');
    expect(tables).toHaveLength(schemaStatements().filter((s) => /^CREATE TABLE/i.test(s)).length);
  });
});

describe('connection handling', () => {
  it('requires TLS for a remote host', () => {
    expect(resolveSsl(SUPABASE_TRANSACTION)).toEqual({ rejectUnauthorized: false });
  });

  it('verifies the certificate when a CA is supplied', () => {
    vi.stubEnv('DATABASE_CA_CERT', '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----');
    const ssl = resolveSsl(SUPABASE_TRANSACTION);
    expect(ssl).toMatchObject({ rejectUnauthorized: true });
    // Escaped newlines survive the trip through an environment variable.
    expect((ssl as { ca: string }).ca).toContain('\n');
  });

  it('does not force TLS on a local database', () => {
    expect(resolveSsl('postgresql://postgres:postgres@localhost:5432/skewvy')).toBe(false);
    expect(resolveSsl('postgresql://postgres:postgres@localhost:5432/skewvy?sslmode=require')).toEqual({
      rejectUnauthorized: false,
    });
  });

  /*
   * Regression: `pg` reads sslmode=require from the URL as verify-full, which
   * silently overrides the explicit ssl option and rejects Supabase's own CA
   * with "self-signed certificate in certificate chain". TLS is decided in one
   * place, so the parameter must not survive into the connection string.
   */
  it('strips sslmode so it cannot override the explicit TLS settings', () => {
    expect(withoutSslMode(`${SUPABASE_SESSION}?sslmode=require`)).not.toContain('sslmode');
    expect(withoutSslMode(`${SUPABASE_SESSION}?sslmode=require`)).toContain('pooler.supabase.com');
    // Untouched when it was never there.
    expect(withoutSslMode(SUPABASE_SESSION)).toBe(SUPABASE_SESSION);
    // Other parameters survive.
    expect(withoutSslMode(`${SUPABASE_SESSION}?sslmode=require&application_name=x`)).toContain('application_name=x');
  });

  it('still honours sslmode when deciding whether to use TLS', () => {
    // Read before it is stripped: the decision is made from the original url.
    expect(resolveSsl('postgresql://postgres:x@localhost:5432/db?sslmode=require')).toEqual({
      rejectUnauthorized: false,
    });
    expect(resolveSsl('postgresql://postgres:x@db.example.com:5432/db?sslmode=disable')).toBe(false);
  });

  it('tells the two Supabase poolers apart', () => {
    expect(isPooledConnection(SUPABASE_TRANSACTION)).toBe(true);
    expect(isTransactionPooler(SUPABASE_TRANSACTION)).toBe(true);
    // Session mode can hold a LISTEN; transaction mode cannot.
    expect(isTransactionPooler(SUPABASE_SESSION)).toBe(false);
    expect(isPooledConnection('postgresql://postgres:x@db.example.com:5432/postgres')).toBe(false);
  });

  it('recognises both PostgreSQL url forms', () => {
    expect(isPostgresUrl(SUPABASE_TRANSACTION)).toBe(true);
    expect(isPostgresUrl('postgres://user:pw@host:5432/db')).toBe(true);
    expect(isPostgresUrl('sqlite:./data/skewvy.db')).toBe(false);
  });

  it('refuses to fall back to a local file in production', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => resolveUrl()).toThrow(/DATABASE_URL is not set/);
  });

  it('falls back to a local file in development', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(resolveUrl()).toBe('sqlite:./data/skewvy.db');
  });
});

describe('the committed Supabase migration', () => {
  /*
   * Two copies of a schema drift apart. The file is what gets pasted into the
   * Supabase dashboard, so a stale one means the deployed database and the
   * application disagree — including about which tables have RLS on.
   */
  it('matches the schema module', () => {
    expect(readFileSync(MIGRATION_PATH, 'utf8')).toBe(migrationFileContents());
  });
});
