import type { NextRequest } from 'next/server';

/** Request metadata used for rate limiting and risk-based step-up decisions. */
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export function requestContext(request: NextRequest): RequestContext {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]!.trim() : request.headers.get('x-real-ip');
  return { ip: ip ?? null, userAgent: request.headers.get('user-agent') };
}

/** Only same-origin relative paths are accepted as post-auth redirects. */
export function safeRedirect(target: string | null | undefined, fallback = '/'): string {
  if (!target) return fallback;
  if (!target.startsWith('/') || target.startsWith('//')) return fallback;
  return target;
}
