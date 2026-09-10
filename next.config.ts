import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Several lockfiles exist above this directory; pin the tracing root here.
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ['pg', '@node-rs/argon2'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    optimizePackageImports: ['@tanstack/react-query'],
  },
};

export default nextConfig;
