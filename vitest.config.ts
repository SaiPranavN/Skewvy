import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      // The test database is the built-in node:sqlite module, which still sits
      // behind a flag; worker processes need it passed explicitly.
      forks: { execArgv: ['--experimental-sqlite', '--disable-warning=ExperimentalWarning'] },
    },
    // Each file owns a temporary database file, so files must not overlap.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
