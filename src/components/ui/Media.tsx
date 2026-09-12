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
    <div className={`@container relative overflow-hidden bg-surface-2 ${className}`}>
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
 * The no-image state. Flat charcoal carrying either the Entity's initials or
 * the category — enough to identify the item at a glance, with no invented
 * artwork standing in for a photograph that does not exist.
 */
function MediaFallback({ label, kind }: { label: string; kind: 'initials' | 'category' }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-surface-2 px-4" aria-hidden="true">
      {kind === 'initials' ? (
        <span className="text-[clamp(1.25rem,7cqi,2.5rem)] font-medium tracking-[-0.02em] text-tertiary">
          {label}
        </span>
      ) : (
        <span className="text-center text-[0.8125rem] uppercase tracking-[0.1em] text-tertiary">{label}</span>
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
