import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolves the hero background.
 *
 * Drop a photograph at `public/hero.jpg` (or .jpeg / .png / .webp / .avif) and
 * it is picked up on the next render — no code change, no rebuild in dev. Until
 * then a dark stand-in ships in its place so the hero never renders empty.
 */
const CANDIDATES = ['hero.jpg', 'hero.jpeg', 'hero.png', 'hero.webp', 'hero.avif'];
const FALLBACK = '/hero-fallback.svg';

export function heroImageUrl(): string {
  const publicDirectory = path.join(process.cwd(), 'public');

  for (const name of CANDIDATES) {
    if (existsSync(path.join(publicDirectory, name))) return `/${name}`;
  }
  return FALLBACK;
}

/** True while the placeholder is standing in for a real photograph. */
export function heroImageIsPlaceholder(): boolean {
  return heroImageUrl() === FALLBACK;
}
