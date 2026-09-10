/**
 * Deterministic editorial cover art.
 *
 * Sample content ships with generated SVG covers instead of hot-linked photos:
 * it keeps the app working offline, guarantees the licence is clean, and lets
 * each card carry a stored accent colour that the UI turns into its glow.
 * Admins can replace any of it with a real image URL.
 */

function hashOf(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG so a slug always renders the same artwork. */
function rng(seed: string): () => number {
  let state = hashOf(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function shiftHue(hex: string, degrees: number, lightness = 0): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const newH = (h + degrees + 360) % 360;
  const newL = Math.min(0.92, Math.max(0.06, l + lightness));
  const c = (1 - Math.abs(2 * newL - 1)) * s;
  const x = c * (1 - Math.abs(((newH / 60) % 2) - 1));
  const m = newL - c / 2;

  const [rr, gg, bb] =
    newH < 60 ? [c, x, 0] :
    newH < 120 ? [x, c, 0] :
    newH < 180 ? [0, c, x] :
    newH < 240 ? [0, x, c] :
    newH < 300 ? [x, 0, c] : [c, 0, x];

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

export interface CoverOptions {
  seed: string;
  accent: string;
  /** Entities get a monogram plate; Flash News gets an abstract composition. */
  kind: 'entity' | 'flash_news';
  monogram?: string;
}

const WIDTH = 1280;
const HEIGHT = 800;

/**
 * The composition is deliberately restrained: one focal glow, a set of strokes
 * that all share a single angle, and a halftone field. Hue shifts stay inside a
 * narrow analogous range of the accent, so the artwork reads as a considered
 * palette rather than a random gradient.
 */
export function renderCoverSvg({ seed, accent, kind, monogram }: CoverOptions): string {
  const random = rng(seed);
  const warm = shiftHue(accent, 18, 0.06);
  const cool = shiftHue(accent, -26, -0.04);

  // One shared angle for every stroke keeps the composition coherent.
  const angle = [-28, -18, 16, 24][Math.floor(random() * 4)];
  const focalX = kind === 'entity' ? 50 : 22 + random() * 56;
  const focalY = kind === 'entity' ? 46 : 20 + random() * 46;

  const strokes = Array.from({ length: 4 }, (_, index) => {
    const y = HEIGHT * (0.12 + index * 0.22) + random() * 40;
    const thickness = index % 2 === 0 ? 3 + random() * 4 : 44 + random() * 90;
    const fill = index % 3 === 0 ? warm : index % 3 === 1 ? accent : cool;
    const opacity = thickness < 12 ? 0.5 + random() * 0.25 : 0.06 + random() * 0.07;
    return `<rect x="-240" y="${y.toFixed(0)}" width="${WIDTH + 480}" height="${thickness.toFixed(0)}" fill="${fill}" opacity="${opacity.toFixed(3)}"/>`;
  }).join('');

  // Halftone field: a printed-poster texture, anchored to one corner.
  const dotOriginX = random() > 0.5 ? WIDTH * 0.6 : -40;
  const dots = Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 14 }, (_, column) => {
      const cx = dotOriginX + column * 52;
      const cy = HEIGHT * 0.52 + row * 34;
      const radius = 1.6 + (row / 9) * 3.4;
      return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${radius.toFixed(1)}" fill="${warm}" opacity="${(0.32 - row * 0.028).toFixed(3)}"/>`;
    }).join(''),
  ).join('');

  const monogramPlate =
    kind === 'entity' && monogram
      ? `<g>
      <rect x="${WIDTH / 2 - 178}" y="${HEIGHT / 2 - 178}" width="356" height="356" rx="104" fill="#07070d" opacity="0.42"/>
      <rect x="${WIDTH / 2 - 178}" y="${HEIGHT / 2 - 178}" width="356" height="356" rx="104" fill="none" stroke="${warm}" stroke-opacity="0.55" stroke-width="2.5"/>
      <text x="${WIDTH / 2}" y="${HEIGHT / 2 + 60}" text-anchor="middle" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="176" font-weight="800" letter-spacing="-8" fill="#faf8ff">${monogram}</text>
    </g>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="presentation">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${shiftHue(accent, 12, -0.3)}"/>
      <stop offset="48%" stop-color="${shiftHue(cool, 0, -0.4)}"/>
      <stop offset="100%" stop-color="#08080f"/>
    </linearGradient>
    <radialGradient id="focal" cx="${focalX.toFixed(1)}%" cy="${focalY.toFixed(1)}%" r="62%">
      <stop offset="0%" stop-color="${warm}" stop-opacity="0.78"/>
      <stop offset="42%" stop-color="${accent}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="40%" r="76%">
      <stop offset="52%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#04040a" stop-opacity="0.8"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="${(hashOf(seed) % 100).toString()}"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#base)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#focal)"/>
  <g transform="rotate(${angle} ${WIDTH / 2} ${HEIGHT / 2})">${strokes}</g>
  <g>${dots}</g>
  ${monogramPlate}
  <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#grain)" opacity="0.05"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>
</svg>`;
}

export function monogramFor(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
