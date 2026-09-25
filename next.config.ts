import type { NextConfig } from 'next';

/**
 * Hosts the image optimiser will fetch from.
 *
 * `https://**` would let anyone with admin access — or anyone who guessed an
 * optimiser URL — use the deployment as an open image proxy, at our bandwidth
 * and against our IP reputation. So the list is narrow.
 *
 * Supabase Storage is matched by wildcard rather than read from
 * `NEXT_PUBLIC_SUPABASE_URL`, because variables from `.env` files are not
 * visible inside this file — Next loads the config before it loads them. Deriving
 * the allowlist from one produced an empty list and rejected every image, which
 * is a miserable thing to debug: uploads succeed, the URL is right, and the page
 * shows a broken image. A wildcard over `*.supabase.co` cannot silently become
 * empty, and is still only Supabase.
 *
 * `IMAGE_HOSTS` is read from the real process environment for anything else —
 * a publisher's CDN, say — and is genuinely optional.
 */
function imageHosts(): string[] {
  const hosts = new Set<string>(['**.supabase.co']);

  for (const host of (process.env.IMAGE_HOSTS ?? '').split(',')) {
    const trimmed = host.trim();
    if (trimmed) hosts.add(trimmed);
  }

  return [...hosts];
}

const nextConfig: NextConfig = {
  // Several lockfiles exist above this directory; pin the tracing root here.
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ['pg', '@node-rs/argon2'],
  images: {
    remotePatterns: imageHosts().map((hostname) => ({ protocol: 'https' as const, hostname })),
  },
  experimental: {
    optimizePackageImports: ['@tanstack/react-query'],
    /*
     * How long the browser keeps a visited page to reuse on back/forward and
     * repeat clicks, instead of asking the server again. Thirty seconds is
     * short enough that nothing reads stale — live totals arrive over the
     * realtime stream regardless — and long enough that moving between a list
     * and the items in it is instant.
     */
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
