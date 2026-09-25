import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import type { PublicUser } from '@/lib/domain/types';

/**
 * The session behind this request, looked up once.
 *
 * The root layout, the page and its metadata all ask who is signed in. Without
 * `cache` each asks the database separately — the same row, fetched two or
 * three times per navigation. React scopes the memo to one server render, so
 * nothing leaks between requests; outside a render it is a plain call.
 */
const sessionForRequest = cache(async () => {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
});

/** Reads the signed-in person for a server component or route handler. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await sessionForRequest();
  return session?.user ?? null;
}

export async function getCurrentSession() {
  return sessionForRequest();
}

export async function requireAdmin(): Promise<PublicUser | null> {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

/** Best-effort client IP for rate limiting and risk signals. */
export async function getClientIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return list.get('x-real-ip') ?? null;
}

export async function getUserAgent(): Promise<string | null> {
  const list = await headers();
  return list.get('user-agent');
}
