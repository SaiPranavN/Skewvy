import { cookies, headers } from 'next/headers';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import type { PublicUser } from '@/lib/domain/types';

/** Reads the signed-in person for a server component or route handler. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const session = await resolveSession(store.get(SESSION_COOKIE)?.value);
  return session?.user ?? null;
}

export async function getCurrentSession() {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
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
