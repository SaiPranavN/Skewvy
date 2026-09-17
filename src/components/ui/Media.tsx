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
 * The no-image state. The card's own tone fills the well and the initials are
 * set at display scale over a halftone dot field — a deliberate printed mark
 * rather than invented artwork standing in for a photograph that does not
 * exist. The tone comes from the `.tone-*` class on an ancestor, so the tile
 * always agrees with the badge and the split bar beside it.
 */
function MediaFallback({ label, kind }: { label: string; kind: 'initials' | 'category' }) {
  return (
    <div className="tile-dots absolute inset-0 grid place-items-center px-4" aria-hidden="true">
      {kind === 'initials' ? (
        <span className="display relative text-[clamp(1.5rem,26cqi,5rem)] leading-none">{label}</span>
      ) : (
        <span className="relative text-center text-[0.8125rem] font-bold uppercase leading-none tracking-[0.12em]">
          {label}
        </span>
      )}
    </div>
  );
}

/** Two-letter fallback used when an Entity has no logo. */
export function initialsFor(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
