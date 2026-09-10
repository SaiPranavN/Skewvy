import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, revokeSession } from '@/lib/services/sessions';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);

  const response = NextResponse.json({ status: 'signed_out' });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', expires: new Date(0), httpOnly: true });
  return response;
}
