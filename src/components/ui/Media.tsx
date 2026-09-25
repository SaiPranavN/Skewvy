import Image from 'next/image';

/**
 * Next's image optimiser rejects SVG unless `dangerouslyAllowSVG` is enabled,
 * answering 400 and taking the surrounding render down with it. A vector gains
 * nothing from rasterisation, so it is served as-is instead of loosening the
 * optimiser for every image on the site.
 */
export function isVectorSource(src: string): boolean {
  return /\.svg($|\?)/i.test(src);
}

/**
 * Editorial media block.
 *
 * When an artifact has an image, it is shown with a neutral black scrim for
 * legibility — never a colour wash. When it does not, the fallback is a plain
 * charcoal surface carrying the entity initials or the category, rather than
 * manufactured artwork.
 */
export function Media({
  src,
  alt,
  fallbackLabel,
  fallbackKind = 'category',
  sizes,
  priority = false,
  scrim = 'none',
  className = '',
}: {
  src: string | null;
  alt: string;
  /** Entity initials, or a category name, depending on `fallbackKind`. */
  fallbackLabel: string;
  fallbackKind?: 'initials' | 'category';
  sizes: string;
  priority?: boolean;
  scrim?: 'none' | 'card' | 'hero';
  className?: string;
}) {
  return (
    // `@container` so the fallback initials can size themselves to the block
    // they sit in, from a 56px thumbnail up to a full-width hero.
    <div className={`tile @container relative overflow-hidden ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          unoptimized={isVectorSource(src)}
          className="media-image"
        />
      ) : (
        <MediaFallback label={fallbackLabel} kind={fallbackKind} />
      )}

      {scrim !== 'none' && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${scrim === 'hero' ? 'media-scrim-hero' : 'media-scrim'}`}
        />
      )}
    </div>
  );
}

/**
 * Bright enough that ink letters read on every one of them, and different
 * enough that a row of imageless cards does not look like one block.
 */
const PLACEHOLDER_COLOURS = ['#ffcb2f', '#ff8a65', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c'];

/** The same label always gets the same colour, on every page and every visit. */
export function placeholderColour(label: string): string {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return PLACEHOLDER_COLOURS[hash % PLACEHOLDER_COLOURS.length];
}

/**
 * The no-image state.
 *
 * Initials in black on a flat colour, over a halftone dot field — a
 * deliberate printed mark rather than invented artwork standing in for a
 * photograph that does not exist. The colour comes from the name, not the
 * verdict, so an item keeps its mark as opinion about it moves.
 *
 * The category variant keeps the tone well: it labels a kind of thing rather
 * than naming one.
 */
function MediaFallback({ label, kind }: { label: string; kind: 'initials' | 'category' }) {
  if (kind === 'initials') {
    return (
      <div
        className="placeholder-tile absolute inset-0 grid place-items-center px-2"
        style={{ backgroundColor: placeholderColour(label) }}
        aria-hidden="true"
      >
        <span className="display relative text-[clamp(1.25rem,30cqi,5rem)] leading-none text-[color:var(--color-ink)]">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="tile-dots absolute inset-0 grid place-items-center px-4" aria-hidden="true">
      {(
        <span className="relative text-center text-[0.8125rem] font-bold uppercase leading-none tracking-[0.12em]">
          {label}
        </span>
      )}
    </div>
  );
}

/** Words that carry no identity, skipped so "Bank of India" reads BI, not BO. */
const FILLER = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 's']);

/** Two-letter mark used when there is no image: "Smriti Mandhana" → SM. */
export function initialsFor(name: string): string {
  const all = name
    .replace(/[’']s\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const words = all.filter((word) => !FILLER.has(word.toLowerCase()));
  const pick = words.length > 0 ? words : all;
  if (pick.length === 0) return '—';
  if (pick.length === 1) {
    const word = pick[0];
    // A short acronym is already its own mark: MTV, not MT.
    return word.length <= 3 && word === word.toUpperCase() ? word : word.slice(0, 2).toUpperCase();
  }
  return (pick[0][0] + pick[1][0]).toUpperCase();
}
