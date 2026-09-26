/**
 * Who the site is, for search engines and link previews.
 *
 * The public address comes from `NEXT_PUBLIC_APP_URL` when it is set to a real
 * host. A production build without it still says skewvy.com rather than
 * localhost: a sitemap or canonical link pointing at localhost would tell
 * Google the site lives nowhere.
 */
export const SITE_NAME = 'Skewvy';

export const SITE_TAGLINE = 'Public sentiment, counted';

export const SITE_DESCRIPTION =
  'Skewvy is a public sentiment index. React to the stories, decisions and profiles shaping the moment: send Rotten Eggs when something deserves criticism, award Medals when it deserves recognition, and see where people really stand.';

export const CONTACT_EMAIL = 'team@skewvy.com';

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;
  if (process.env.NODE_ENV === 'production') return 'https://skewvy.com';
  return configured || 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * The site's own preview image, for a page that has no picture of its own.
 * A page that sets any Open Graph fields replaces the inherited ones wholesale,
 * so a Story without an image would otherwise share with no preview at all.
 */
export const DEFAULT_SHARE_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'Skewvy — public sentiment, counted',
};
