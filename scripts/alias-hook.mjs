import { pathToFileURL, fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolution shim for scripts run directly by Node, so CLI tasks can import the
 * same service layer the app uses. It handles two things the bundler does for
 * us but plain Node does not: the `@/` alias, and extensionless imports of
 * TypeScript files. Next.js and Vitest resolve both themselves.
 */
const srcRoot = path.join(process.cwd(), 'src');

function firstExistingFile(basePath) {
  const candidates = [basePath, `${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, 'index.ts')];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const resolved = firstExistingFile(path.join(srcRoot, specifier.slice(2)));
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  if (specifier.startsWith('.') && !path.extname(specifier) && context.parentURL?.startsWith('file:')) {
    const parentDirectory = path.dirname(fileURLToPath(context.parentURL));
    const resolved = firstExistingFile(path.resolve(parentDirectory, specifier));
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  return nextResolve(specifier, context);
}
