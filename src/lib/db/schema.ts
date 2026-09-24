/**
 * Source of truth for the Skewvy schema.
 *
 * Kept as a TypeScript string rather than a `.sql` file so the migration runs
 * unchanged inside the Next.js server bundle, where relative file reads break.
 * `npm run db:migrate` also mirrors it to `db/schema.sql` for anyone applying it
 * to PostgreSQL by hand.
 */
export const SCHEMA_SQL = `-- Skewvy schema. Written to be valid on both SQLite and PostgreSQL:
-- ids are application-generated UUID text, timestamps are ISO-8601 UTC text,
-- and booleans are stored as 0/1 integers.

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  email               TEXT NOT NULL,
  email_normalized    TEXT NOT NULL UNIQUE,
  email_verified_at   TEXT,
  pin_hash            TEXT NOT NULL,
  pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until    TEXT,
  is_admin            INTEGER NOT NULL DEFAULT 0,
  suspended_at        TEXT,
  suspended_reason    TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  last_used_at    TEXT NOT NULL,
  revoked_at      TEXT,
  device_metadata TEXT,
  ip_hash         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One-time email links: verification, PIN reset and risk-based step-up.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash        TEXT NOT NULL UNIQUE,
  token_type        TEXT NOT NULL CHECK (token_type IN ('email_verification', 'pin_reset', 'step_up')),
  expires_at        TEXT NOT NULL,
  consumed_at       TEXT,
  created_at        TEXT NOT NULL,
  requested_ip_hash TEXT,
  redirect_to       TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id, token_type);

-- A sign-up that has not proved its email address yet.
--
-- Deliberately not a half-made row in the users table: until the address is
-- proven, no account exists at all. Registering with someone else's address
-- therefore creates nothing they have to reclaim, and an abandoned sign-up
-- leaves the address free.
CREATE TABLE IF NOT EXISTS pending_registrations (
  id                TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  email             TEXT NOT NULL,
  email_normalized  TEXT NOT NULL,
  token_hash        TEXT NOT NULL UNIQUE,
  expires_at        TEXT NOT NULL,
  consumed_at       TEXT,
  created_at        TEXT NOT NULL,
  requested_ip_hash TEXT,
  redirect_to       TEXT
);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email_normalized);

CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  image_url   TEXT,
  accent      TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);

CREATE TABLE IF NOT EXISTS flash_news (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  headline     TEXT NOT NULL,
  summary      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL,
  image_url    TEXT,
  accent       TEXT,
  source_label TEXT,
  source_url   TEXT,
  published_at TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flash_news_status ON flash_news(status, published_at);

CREATE TABLE IF NOT EXISTS flash_news_entities (
  flash_news_id TEXT NOT NULL REFERENCES flash_news(id) ON DELETE CASCADE,
  entity_id     TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (flash_news_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_fne_entity ON flash_news_entities(entity_id);

-- One row per user per artifact. Repeated tapping never adds rows here.
CREATE TABLE IF NOT EXISTS opinions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('entity', 'flash_news')),
  artifact_id   TEXT NOT NULL,
  stance        TEXT NOT NULL CHECK (stance IN ('positive', 'negative')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (user_id, artifact_type, artifact_id)
);
CREATE INDEX IF NOT EXISTS idx_opinions_artifact ON opinions(artifact_type, artifact_id);

-- Every change of side, kept for good.
--
-- A Flash News opinion is final, but an Entity is a standing record and a
-- person's view of it can move. When it does, the opinions row is updated in
-- place and the change is written here — which is what lets the opinion
-- history be rebuilt exactly, and means a switch never erases the fact that
-- this person once stood on the other side.
CREATE TABLE IF NOT EXISTS opinion_changes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('entity', 'flash_news')),
  artifact_id   TEXT NOT NULL,
  from_stance   TEXT NOT NULL CHECK (from_stance IN ('positive', 'negative')),
  to_stance     TEXT NOT NULL CHECK (to_stance IN ('positive', 'negative')),
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opinion_changes_artifact ON opinion_changes(artifact_type, artifact_id, created_at);

-- Aggregated contribution per user per artifact. Never one row per tap.
CREATE TABLE IF NOT EXISTS reaction_aggregates (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type    TEXT NOT NULL CHECK (artifact_type IN ('entity', 'flash_news')),
  artifact_id      TEXT NOT NULL,
  rotten_egg_count INTEGER NOT NULL DEFAULT 0,
  medal_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (user_id, artifact_type, artifact_id)
);
CREATE INDEX IF NOT EXISTS idx_reaction_aggregates_artifact ON reaction_aggregates(artifact_type, artifact_id);

-- Two kinds of number, kept apart on purpose.
--
-- \`rotten_egg_total\` and \`medal_total\` count taps: one person can add hundreds.
-- \`positive_opinion_total\` and \`negative_opinion_total\` count people: one person
-- adds exactly one, once, and never moves it. The contributor totals are the
-- bridge between them — how many distinct people are behind each tap total —
-- and they are maintained as their own columns rather than derived, because no
-- arithmetic on a tap total can recover a head count.
CREATE TABLE IF NOT EXISTS artifact_totals (
  artifact_type           TEXT NOT NULL CHECK (artifact_type IN ('entity', 'flash_news')),
  artifact_id             TEXT NOT NULL,
  rotten_egg_total        INTEGER NOT NULL DEFAULT 0,
  medal_total             INTEGER NOT NULL DEFAULT 0,
  positive_opinion_total  INTEGER NOT NULL DEFAULT 0,
  negative_opinion_total  INTEGER NOT NULL DEFAULT 0,
  unique_participant_total INTEGER NOT NULL DEFAULT 0,
  rotten_egg_contributor_total INTEGER NOT NULL DEFAULT 0,
  medal_contributor_total      INTEGER NOT NULL DEFAULT 0,
  updated_at              TEXT NOT NULL,
  PRIMARY KEY (artifact_type, artifact_id)
);

-- Short-lived batch ledger: powers idempotent retries and velocity ranking.
CREATE TABLE IF NOT EXISTS reaction_batches (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type   TEXT NOT NULL,
  artifact_id     TEXT NOT NULL,
  reaction_type   TEXT NOT NULL CHECK (reaction_type IN ('rotten_egg', 'medal')),
  quantity        INTEGER NOT NULL,
  client_batch_id TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (user_id, client_batch_id)
);
CREATE INDEX IF NOT EXISTS idx_reaction_batches_recent ON reaction_batches(artifact_type, artifact_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reaction_batches_created ON reaction_batches(created_at);

-- Hourly rollup of reactions per artifact, written alongside the totals in the
-- same transaction. One row per artifact per hour, never one per tap: it exists
-- so the trend chart has a real history to draw without scanning the ledger.
-- Hourly rather than daily because a Flash News item can be nine hours old, and
-- a chart of it needs more than one point. Days are a GROUP BY away.
CREATE TABLE IF NOT EXISTS reaction_timeline (
  artifact_type    TEXT NOT NULL CHECK (artifact_type IN ('entity', 'flash_news')),
  artifact_id      TEXT NOT NULL,
  bucket_start     TEXT NOT NULL,
  rotten_egg_count INTEGER NOT NULL DEFAULT 0,
  medal_count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artifact_type, artifact_id, bucket_start)
);
CREATE INDEX IF NOT EXISTS idx_reaction_timeline_artifact ON reaction_timeline(artifact_type, artifact_id, bucket_start);

-- The same rollup for opinions, and deliberately a separate table.
--
-- An opinion bucket counts people who took a side during that hour — at most
-- one increment per person, ever — so it can never be plotted on the same axis
-- as the reaction buckets beside it. Keeping them apart in storage is what
-- stops them being accidentally summed together later.
CREATE TABLE IF NOT EXISTS opinion_timeline (
  artifact_type  TEXT NOT NULL CHECK (artifact_type IN ('entity', 'flash_news')),
  artifact_id    TEXT NOT NULL,
  bucket_start   TEXT NOT NULL,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artifact_type, artifact_id, bucket_start)
);
CREATE INDEX IF NOT EXISTS idx_opinion_timeline_artifact ON opinion_timeline(artifact_type, artifact_id, bucket_start);

-- Open discussion on an artifact. Unlike reactions, commenting has nothing to
-- do with having taken a side: anyone signed in may post, whether or not they
-- have ever sent an Egg or a Medal.
CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('entity', 'flash_news')),
  artifact_id   TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  like_count    INTEGER NOT NULL DEFAULT 0,
  dislike_count INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_artifact ON comments(artifact_type, artifact_id, created_at);

-- One vote per person per comment. Switchable and removable, unlike a stance.
CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value      INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user ON comment_votes(user_id);

-- A person flagging a comment for review. One report per person per comment,
-- so repeating a report cannot inflate the count the review queue sorts by.
-- Resolution is kept rather than the row deleted: a dismissed report is the
-- record that somebody looked, and when.
CREATE TABLE IF NOT EXISTS comment_reports (
  id          TEXT PRIMARY KEY,
  comment_id  TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('harassment', 'hate', 'spam', 'misinformation', 'other')),
  details     TEXT,
  created_at  TEXT NOT NULL,
  resolved_at TEXT,
  resolution  TEXT CHECK (resolution IN ('removed', 'dismissed')),
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (comment_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_reports_open ON comment_reports(resolved_at, created_at);

-- Server-side rate limiting; a fixed window keyed by action + subject.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key   TEXT PRIMARY KEY,
  hit_count    INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/**
 * Columns added after a table first shipped.
 *
 * `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists, so
 * a new column has to be added explicitly or production keeps the old shape.
 * Applied one at a time and only when missing, which both engines tolerate —
 * SQLite has no `ADD COLUMN IF NOT EXISTS`.
 */
export const ADDED_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  { table: 'users', column: 'suspended_at', definition: 'TEXT' },
  { table: 'users', column: 'suspended_reason', definition: 'TEXT' },
  { table: 'artifact_totals', column: 'rotten_egg_contributor_total', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'artifact_totals', column: 'medal_contributor_total', definition: 'INTEGER NOT NULL DEFAULT 0' },
];

/**
 * The added columns as PostgreSQL statements, for the generated migration file.
 *
 * `CREATE TABLE IF NOT EXISTS` is a no-op against a table that already exists,
 * so a schema file alone cannot add a column to a live database — it would
 * create the new tables, skip the altered one, and leave the application
 * querying a column that is not there. `migrate()` handles this by checking
 * each column and adding what is missing, but anyone applying the `.sql` file
 * directly (`supabase db push`, or the dashboard SQL editor) never runs that
 * code. Emitting the statements here means both routes arrive at the same
 * schema.
 *
 * PostgreSQL only, which is what the file is for: `IF NOT EXISTS` on
 * `ADD COLUMN` is not something SQLite accepts.
 */
export function addedColumnsSql(): string {
  return ADDED_COLUMNS.map(
    ({ table, column, definition }) => `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition};`,
  ).join('\n');
}

/** Every table the schema defines, in creation order. */
export function schemaTables(): string[] {
  return [...SCHEMA_SQL.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)].map((match) => match[1]);
}

/**
 * Locks the tables away from Supabase's public API.
 *
 * Supabase exposes every table in the `public` schema through PostgREST, and
 * the publishable key that reaches it is meant to be public — it ships in the
 * browser. A table sitting there without row-level security is world-readable
 * and, depending on its grants, world-writable. Skewvy holds password hashes,
 * session tokens and email addresses, so that is not a risk worth carrying.
 *
 * Enabling RLS with no policies denies every request that arrives through the
 * API, while the owning role the application connects as bypasses RLS and is
 * unaffected. The grants are revoked as well, so neither mechanism alone has to
 * be the only thing standing between the anon key and the users table.
 *
 * PostgreSQL only. Applied by `migrate()` when the dialect is `postgres`, and
 * written into the Supabase migration file.
 */
export function postgresHardeningSql(): string {
  const tables = schemaTables()
    .map((table) => `'${table}'`)
    .join(', ');

  return `DO $skewvy$
DECLARE
  target text;
  supabase_roles boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
BEGIN
  FOREACH target IN ARRAY ARRAY[${tables}]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = target) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
      IF supabase_roles THEN
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', target);
      END IF;
    END IF;
  END LOOP;

  IF supabase_roles THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
  END IF;
END
$skewvy$;`;
}

/** The Supabase Storage bucket holding uploaded Entity and Flash News images. */
export const IMAGE_BUCKET = 'artifact-images';

/** Matches the limits the upload action enforces before a byte is sent. */
export const IMAGE_MAX_BYTES = 6 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'] as const;

/**
 * Creates the image bucket.
 *
 * Public read: these images are published on the site, so signing every URL
 * would buy nothing and cost a round trip. Writes are a different matter —
 * no policy grants `anon` or `authenticated` any access to `storage.objects`,
 * so the only way in is the secret key held by the server.
 *
 * The size and type limits are repeated here on purpose. The upload action
 * checks them before sending, and Storage enforces them again on arrival, so a
 * request that skips the action cannot put a 200 MB file in the bucket.
 *
 * Skipped when the `storage` schema is absent, which is every PostgreSQL that
 * is not Supabase.
 */
export function storageSetupSql(): string {
  const mimeTypes = IMAGE_MIME_TYPES.map((type) => `'${type}'`).join(', ');

  return `DO $skewvy_storage$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('${IMAGE_BUCKET}', '${IMAGE_BUCKET}', true, ${IMAGE_MAX_BYTES}, ARRAY[${mimeTypes}])
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = ${IMAGE_MAX_BYTES},
      allowed_mime_types = ARRAY[${mimeTypes}];
  END IF;
END
$skewvy_storage$;`;
}

/** Splits the schema into individually executable statements. */
export function schemaStatements(): string[] {
  return SCHEMA_SQL.split(/;\s*(?:\r?\n|$)/)
    .map((statement) =>
      statement
        // Drop whole-line comments so a comment above a statement never
        // swallows the statement itself.
        .split('\n')
        .filter((line) => !/^\s*--/.test(line))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}
