import { rm } from 'node:fs/promises';
import path from 'node:path';
import { seedDatabase } from '@/lib/seed/seeder';
import { getDb } from '@/lib/db';

const url = process.env.DATABASE_URL?.trim() || 'sqlite:./data/skewvy.db';

if (!url.startsWith('postgres')) {
  const file = url.replace(/^sqlite:(\/\/)?/, '');
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    await rm(path.resolve(file + suffix), { force: true });
  }
  console.info('🗑️  Removed the local SQLite database file.');
}

const result = await seedDatabase({ reset: true, log: (message) => console.info(`   ${message}`) });
console.info(`\n✅ Fresh database with ${result.entities} Entities and ${result.flashNews} Flash News items.`);

const db = await getDb();
await db.close();
