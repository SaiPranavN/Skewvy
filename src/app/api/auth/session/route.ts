import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/** Lets the client confirm an existing session without a full page load. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
