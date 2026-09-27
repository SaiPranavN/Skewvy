import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import type { PublicUser } from '@/lib/domain/types';

/**
 * Every MoodStamps page is private. Anyone signed out goes to sign in, and
 * comes back to the page they asked for afterwards.
 */
export async function requireMoodStampsUser(returnTo: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}
