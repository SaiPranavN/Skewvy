-- Skewvy — initial schema for Supabase.
--
-- Generated from src/lib/db/schema.ts, which is the source of truth. Do not
-- edit this file by hand; run `npm run db:generate` instead.
--
-- Apply with either:
--   npm run db:migrate            (uses DATABASE_URL)
--   supabase db push              (Supabase CLI)
--   or paste into the SQL editor in the Supabase dashboard.

-- Skewvy schema. Written to be valid on both SQLite and PostgreSQL:
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
-- `rotten_egg_total` and `medal_total` count taps: one person can add hundreds.
-- `positive_opinion_total` and `negative_opinion_total` count people: one person
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


-- ---------------------------------------------------------------------------
-- Columns added to tables that already existed. CREATE TABLE IF NOT EXISTS
-- does nothing to a live table, so these have to be stated separately or a
-- database that predates them keeps the old shape. See addedColumnsSql().
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE artifact_totals ADD COLUMN IF NOT EXISTS rotten_egg_contributor_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artifact_totals ADD COLUMN IF NOT EXISTS medal_contributor_total INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Keep these tables out of the public API. See postgresHardeningSql().
-- ---------------------------------------------------------------------------
DO $skewvy$
DECLARE
  target text;
  supabase_roles boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
BEGIN
  FOREACH target IN ARRAY ARRAY['users', 'sessions', 'auth_tokens', 'pending_registrations', 'entities', 'flash_news', 'flash_news_entities', 'opinions', 'opinion_changes', 'reaction_aggregates', 'artifact_totals', 'reaction_batches', 'reaction_timeline', 'opinion_timeline', 'comments', 'comment_votes', 'comment_reports', 'rate_limits', 'app_settings']
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
$skewvy$;

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded images. See storageSetupSql().
-- ---------------------------------------------------------------------------
DO $skewvy_storage$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('artifact-images', 'artifact-images', true, 6291456, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'])
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = 6291456,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'];
  END IF;
END
$skewvy_storage$;
