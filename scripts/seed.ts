import { seedDatabase } from '@/lib/seed/seeder';
import { getDb } from '@/lib/db';

const reset = process.argv.includes('--reset') || process.argv.includes('--fresh');
const started = Date.now();

const result = await seedDatabase({ reset, log: (message) => console.info(`   ${message}`) });

console.info(
  `\n🥚🏅 Seeded ${result.entities} Entities and ${result.flashNews} Flash News items, ` +
    `${result.participants.toLocaleString()} participant records and ` +
    `${result.reactions.toLocaleString()} reactions in ${((Date.now() - started) / 1000).toFixed(1)}s.`,
);

const db = await getDb();
await db.close();
