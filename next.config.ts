import type { NextConfig } from 'next';

/**
 * Hosts the image optimiser will fetch from.
 *
 * `https://**` would let anyone with admin access — or anyone who guessed an
 * optimiser URL — use the deployment as an open image proxy, at our bandwidth
 * and against our IP reputation. Supabase Storage is where uploads go;
 * `IMAGE_HOSTS` is a comma-separated escape hatch for pasting an image from a
 * publisher's own CDN.
 */
function imageHosts(): string[] {
  const hosts = new Set<string>();

  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) {
    try {
      hosts.add(new URL(supabase).hostname);
    } catch {
      // A malformed URL simply contributes no host.
    }
  }

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
  },
};

export default nextConfig;
