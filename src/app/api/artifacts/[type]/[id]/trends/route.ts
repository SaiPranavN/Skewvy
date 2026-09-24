import { NextResponse, type NextRequest } from 'next/server';
import { artifactTypeSchema } from '@/lib/validation/schemas';
import { artifactTrends } from '@/lib/services/timeline';
import { artifactIsReactable } from '@/lib/services/reactions';
import { isTrendRange } from '@/lib/domain/trend-ranges';
import { apiError } from '@/lib/api/responses';

/**
 * Both trend histories for one artifact over a chosen range.
 *
 * Public, like the pages that draw them. An unknown range is refused rather
 * than quietly defaulted, so a stale client asking for something that no
 * longer exists hears about it instead of drawing the wrong window.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await context.params;

  const parsedType = artifactTypeSchema.safeParse(type);
  if (!parsedType.success) return apiError(400, 'invalid_artifact_type', 'Unknown artifact type.');

  const range = request.nextUrl.searchParams.get('range');
  if (range !== null && !isTrendRange(range)) return apiError(400, 'invalid_range', 'Unknown range.');

  if (!(await artifactIsReactable(parsedType.data, id))) {
    return apiError(404, 'artifact_not_found', 'That page does not exist.');
  }

  const trends = await artifactTrends(parsedType.data, id, range ? { range } : {});
  return NextResponse.json(trends, { headers: { 'cache-control': 'no-store' } });
}
