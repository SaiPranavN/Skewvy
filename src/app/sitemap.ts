import type { MetadataRoute } from 'next';
import { listEntities, listFlashNews } from '@/lib/services/content';
import { absoluteUrl } from '@/lib/site';

/**
 * Every public page a search engine should know about: the fixed sections,
 * then each published Profile and Story with the time it last changed.
 *
 * Built on request and cached for an hour, so a newly published item is
 * listed without a redeploy. If the database cannot be reached the fixed
 * sections are still served — a failing sitemap is worse than a short one.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: absoluteUrl('/flash-news'), lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: absoluteUrl('/entities'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/trending'), lastModified: now, changeFrequency: 'hourly', priority: 0.7 },
  ];

  try {
    const [profiles, stories] = await Promise.all([listEntities({ limit: 5000 }), listFlashNews({ limit: 5000 })]);

    return [
      ...fixed,
      ...stories.map((story) => ({
        url: absoluteUrl(`/flash-news/${story.slug}`),
        lastModified: new Date(story.updatedAt),
        changeFrequency: 'daily' as const,
        priority: 0.8,
        ...(story.imageUrl ? { images: [story.imageUrl] } : {}),
      })),
      ...profiles.map((profile) => ({
        url: absoluteUrl(`/entities/${profile.slug}`),
        lastModified: new Date(profile.updatedAt),
        changeFrequency: 'daily' as const,
        priority: 0.7,
        ...(profile.imageUrl ? { images: [profile.imageUrl] } : {}),
      })),
    ];
  } catch (error) {
    console.error('[sitemap] could not list content:', error instanceof Error ? error.message : error);
    return fixed;
  }
}
