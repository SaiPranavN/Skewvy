import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderCoverSvg, monogramFor } from '@/lib/seed/covers';
import { SEED_ENTITIES, SEED_FLASH_NEWS } from '@/lib/seed/data';

const outputDirectory = path.join(process.cwd(), 'public', 'covers');
await mkdir(outputDirectory, { recursive: true });

for (const entity of SEED_ENTITIES) {
  const svg = renderCoverSvg({
    seed: entity.slug,
    accent: entity.accent,
    kind: 'entity',
    monogram: monogramFor(entity.name),
  });
  await writeFile(path.join(outputDirectory, `${entity.slug}.svg`), svg, 'utf8');
}

for (const item of SEED_FLASH_NEWS) {
  const svg = renderCoverSvg({ seed: item.slug, accent: item.accent, kind: 'flash_news' });
  await writeFile(path.join(outputDirectory, `${item.slug}.svg`), svg, 'utf8');
}

console.info(`🎨 Generated ${SEED_ENTITIES.length + SEED_FLASH_NEWS.length} cover images in public/covers.`);
