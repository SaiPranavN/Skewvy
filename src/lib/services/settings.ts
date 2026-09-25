import { execute, queryOne } from '@/lib/db';

/** Site-wide editorial choices, one text value per key, in `app_settings`. */

export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = $1', [key]);
  return row?.value ?? null;
}

/** Stores a value, or clears the key when given null. */
export async function setSetting(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await execute('DELETE FROM app_settings WHERE key = $1', [key]);
    return;
  }
  await execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, value, new Date().toISOString()],
  );
}

/* -------------------------------- lead story ------------------------------- */

const LEAD_STORY_KEY = 'lead_story_id';

/**
 * The Story an editor pinned as the lead on the Stories page, if any.
 *
 * Only a choice, not a guarantee: the page shows it only while it is
 * published, and falls back to the newest Story otherwise — so unpublishing or
 * deleting the pinned Story can never leave the page without a lead.
 */
export function getLeadStoryId(): Promise<string | null> {
  return getSetting(LEAD_STORY_KEY);
}

export function setLeadStoryId(id: string | null): Promise<void> {
  return setSetting(LEAD_STORY_KEY, id);
}
