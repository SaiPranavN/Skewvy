import { NextResponse, type NextRequest } from 'next/server';
import { artifactTypeSchema } from '@/lib/validation/schemas';
import { getTotals, getContribution } from '@/lib/services/totals';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError } from '@/lib/api/responses';

/** Authoritative totals for one artifact, plus the viewer's own contribution. */
export async function GET(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await context.params;

  const parsedType = artifactTypeSchema.safeParse(type);
  if (!parsedType.success) return apiError(400, 'invalid_artifact_type', 'Unknown artifact type.');

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  const [totals, contribution] = await Promise.all([
    getTotals(parsedType.data, id),
    session ? getContribution(session.user.id, parsedType.data, id) : Promise.resolve(null),
  ]);

  return NextResponse.json({ totals, contribution }, { headers: { 'cache-control': 'no-store' } });
}
