import { migrate } from '@/lib/db/migrate';
import { backfillReactionTimeline, backfillOpinionTimeline } from '@/lib/services/timeline';
import { backfillContributorTotals } from '@/lib/services/totals';
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

/*
 * The opinion history is reconstructed the same way, and exactly: every
 * opinion row carries the moment its side was taken.
 */
const opinionBuckets = await backfillOpinionTimeline();
if (opinionBuckets > 0) {
  console.info(`👥 Reconstructed ${opinionBuckets.toLocaleString()} opinion buckets from recorded sides.`);
}

/*
 * Artifacts written before the contributor columns existed report reactions
 * from nobody. Recomputed from the aggregates, which never lost the head count.
 */
const repaired = await backfillContributorTotals();
if (repaired > 0) console.info(`🧮 Filled contributor counts on ${repaired.toLocaleString()} artifacts.`);

await db.close();
