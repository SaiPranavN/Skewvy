import { migrate } from '@/lib/db/migrate';
import { getDb } from '@/lib/db';

const db = await getDb();
await migrate();
console.info(`✅ Schema applied (${db.dialect}).`);
await db.close();
