import { writeFileSync } from 'node:fs';
import { migrationFileContents, MIGRATION_PATH } from '@/lib/db/migration-file';

writeFileSync(MIGRATION_PATH, migrationFileContents());
console.info(`✅ Wrote ${MIGRATION_PATH} from src/lib/db/schema.ts.`);
