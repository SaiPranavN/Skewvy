import { NextResponse } from 'next/server';
import { turnstileSiteKey, turnstileDisabled } from '@/lib/services/turnstile';

/** Public auth configuration for client-rendered forms. */
export async function GET() {
  return NextResponse.json({
    turnstileSiteKey: turnstileSiteKey(),
    // Development-only escape hatch; `turnstileDisabled()` always returns false
    // when NODE_ENV is production, whatever the environment variable says.
    turnstileDisabled: turnstileDisabled(),
  });
}
