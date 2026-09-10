import { query, queryOne, execute } from '@/lib/db';
import { newId } from './crypto';
import { applyReactionBatch } from './reactions';
import { hashPin } from './pin';
import type { ArtifactType, ReactionType } from '@/lib/domain/types';

/**
 * Development-only crowd simulator. It writes through the same service the real
 * reaction endpoint uses, so trending velocity and totals stay consistent — but
 * it is labelled everywhere it surfaces and refuses to run in production unless
 * ALLOW_SIMULATOR=1 is set explicitly.
 */

const SETTING_KEY = 'simulator_enabled';
const SIMULATED_EMAIL_DOMAIN = 'demo-crowd.skewvy.invalid';

const globalForSimulator = globalThis as unknown as { __skewvyTimer?: NodeJS.Timeout | null };

export function simulatorAllowed(): boolean {
  if (process.env.ALLOW_SIMULATOR === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

export async function simulatorEnabled(): Promise<boolean> {
  if (!simulatorAllowed()) return false;
  const row = await queryOne<{ value: string }>('SELECT value FROM app_settings WHERE key = $1', [SETTING_KEY]);
  return row?.value === 'on';
}

export async function setSimulatorEnabled(enabled: boolean): Promise<boolean> {
  if (!simulatorAllowed()) return false;
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
    [SETTING_KEY, enabled ? 'on' : 'off', now],
  );

  if (enabled) startSimulatorLoop();
  else stopSimulatorLoop();
  return enabled;
}

/** A stable pool of demo accounts so unique-participant counts move believably. */
export async function ensureSimulatedUsers(count = 40): Promise<string[]> {
  const existing = await query<{ id: string }>('SELECT id FROM users WHERE email_normalized LIKE $1 ORDER BY created_at', [
    `%@${SIMULATED_EMAIL_DOMAIN}`,
  ]);
  if (existing.length >= count) return existing.map((row) => row.id);

  const now = new Date().toISOString();
  // One hash reused across demo accounts: these can never be signed into anyway.
  const pinHash = await hashPin(`demo-crowd-${newId()}`);
  const ids = existing.map((row) => row.id);

  for (let index = existing.length; index < count; index += 1) {
    const id = newId();
    const email = `crowd-${index}@${SIMULATED_EMAIL_DOMAIN}`;
    await execute(
      `INSERT INTO users (id, display_name, email, email_normalized, pin_hash, email_verified_at, created_at, updated_at)
       VALUES ($1, $2, $3, $3, $4, $5, $5, $5)`,
      [id, `Crowd member ${index + 1}`, email, pinHash, now],
    );
    ids.push(id);
  }
  return ids;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** One burst: a handful of demo people each send a small batch. */
export async function runSimulationTick(): Promise<number> {
  const artifacts = await loadReactableArtifacts();
  if (artifacts.length === 0) return 0;

  const users = await ensureSimulatedUsers();
  if (users.length === 0) return 0;

  const bursts = 1 + Math.floor(Math.random() * 3);
  let applied = 0;

  for (let index = 0; index < bursts; index += 1) {
    const artifact = pick(artifacts);
    const userId = pick(users);
    // Lean the demo crowd the way the artifact is already leaning, so the
    // sentiment picture stays coherent rather than drifting to a flat 50/50.
    const eggBias = artifact.eggBias;
    const reactionType: ReactionType = Math.random() < eggBias ? 'rotten_egg' : 'medal';
    const quantity = 3 + Math.floor(Math.random() * 45);

    await applyReactionBatch({
      userId,
      artifactType: artifact.type,
      artifactId: artifact.id,
      reactionType,
      quantity,
      clientBatchId: `sim-${newId()}`,
      source: 'simulator',
    });
    applied += quantity;
  }

  return applied;
}

interface SimulatableArtifact {
  type: ArtifactType;
  id: string;
  eggBias: number;
}

async function loadReactableArtifacts(): Promise<SimulatableArtifact[]> {
  const entities = await query<{ id: string }>(`SELECT id FROM entities WHERE status = 'published'`);
  const flashNews = await query<{ id: string }>(`SELECT id FROM flash_news WHERE status = 'published'`);
  const totals = await query<{ artifact_type: string; artifact_id: string; rotten_egg_total: number; medal_total: number }>(
    'SELECT artifact_type, artifact_id, rotten_egg_total, medal_total FROM artifact_totals',
  );

  const biasByKey = new Map<string, number>();
  for (const row of totals) {
    const total = Number(row.rotten_egg_total) + Number(row.medal_total);
    const bias = total > 0 ? Number(row.rotten_egg_total) / total : 0.5;
    // Nudge toward the middle so a lopsided artifact can still swing.
    biasByKey.set(`${row.artifact_type}:${row.artifact_id}`, 0.15 + bias * 0.7);
  }

  const list: SimulatableArtifact[] = [];
  for (const row of entities) list.push({ type: 'entity', id: row.id, eggBias: biasByKey.get(`entity:${row.id}`) ?? 0.5 });
  for (const row of flashNews) list.push({ type: 'flash_news', id: row.id, eggBias: biasByKey.get(`flash_news:${row.id}`) ?? 0.5 });
  return list;
}

/** Irregular interval so the activity never looks metronomic. */
function nextDelay(): number {
  return 1200 + Math.floor(Math.random() * 2600);
}

export function startSimulatorLoop(): void {
  if (!simulatorAllowed() || globalForSimulator.__skewvyTimer) return;

  const schedule = () => {
    globalForSimulator.__skewvyTimer = setTimeout(async () => {
      try {
        await runSimulationTick();
      } catch {
        // Never let demo activity take the app down.
      }
      if (globalForSimulator.__skewvyTimer) schedule();
    }, nextDelay());
  };

  globalForSimulator.__skewvyTimer = setTimeout(() => schedule(), 0);
}

export function stopSimulatorLoop(): void {
  if (globalForSimulator.__skewvyTimer) clearTimeout(globalForSimulator.__skewvyTimer);
  globalForSimulator.__skewvyTimer = null;
}

export function simulatorRunning(): boolean {
  return Boolean(globalForSimulator.__skewvyTimer);
}

/** Restores the loop after a server restart if it was left on. */
export async function resumeSimulatorIfEnabled(): Promise<void> {
  if (await simulatorEnabled()) startSimulatorLoop();
}
