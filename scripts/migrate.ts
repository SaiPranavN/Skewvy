import { migrate } from '@/lib/db/migrate';
import { backfillReactionTimeline } from '@/lib/services/timeline';
import { getDb } from '@/lib/db';

const db = await getDb();
await migrate();
console.info(`✅ Schema applied (${db.dialect}).`);

/*
 * Artifacts that were reacted to before the hourly rollup existed have no
 * history to plot. Their aggregates still carry the moment each person first
 * reacted, which is enough to reconstruct one — and only artifacts with no
 * buckets at all are touched, so recorded history is never rewritten.
 */
const filled = await backfillReactionTimeline();
if (filled > 0) console.info(`📈 Reconstructed ${filled.toLocaleString()} history buckets from existing reactions.`);

await db.close();
