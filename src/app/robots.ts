import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Everything public is open to crawlers. Accounts, admin and the API are not:
 * they hold nothing a search result should lead to.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/profile', '/login', '/register', '/auth/', '/dev/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
