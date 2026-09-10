import { NextResponse, type NextRequest } from 'next/server';
import { verifyEmailToken, completeStepUp } from '@/lib/services/auth';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/services/sessions';
import { apiError } from '@/lib/api/responses';
import { requestContext, safeRedirect } from '@/lib/api/request-context';

/**
 * Consumes an emailed link. The same endpoint handles first-time email
 * verification and risk-based step-up, so a person only ever clicks one link.
 */
export async function POST(request: NextRequest) {
  const { ip, userAgent } = requestContext(request);
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();

  if (!token) {
    return apiError(400, 'missing_token', 'That link is incomplete. Ask for a new one.');
  }

  // Verification tokens are tried first; step-up links reuse the same page.
  let result = await verifyEmailToken(token, { ip, userAgent });
  if (!result.ok && result.reason === 'not_found') {
    result = await completeStepUp(token, { ip, userAgent });
  }

  if (!result.ok) {
    const messages = {
      not_found: 'That link is not valid. Ask for a fresh one.',
      expired: 'That link has expired. Ask for a fresh one.',
      already_used: 'That link has already been used. Sign in with your email and PIN.',
    } as const;
    return apiError(400, result.reason, messages[result.reason]);
  }

  const response = NextResponse.json({
    status: 'verified',
    user: result.user,
    redirectTo: safeRedirect(result.redirectTo, '/'),
  });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(result.expiresAt));
  return response;
}
