import { NextResponse, type NextRequest } from 'next/server';
import { opinionSwitchSchema } from '@/lib/validation/schemas';
import { switchOpinion } from '@/lib/services/opinions';
import { artifactIsReactable } from '@/lib/services/reactions';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';

/**
 * Changes the viewer's recorded side on an artifact.
 *
 * Only Entities allow it; a Flash News side is final and is refused here, not
 * merely hidden in the interface. Reactions already sent are untouched.
 */
export async function POST(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthenticated', 'Sign in to change your position.');

  const parsed = opinionSwitchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const limit = await consumeRateLimit(`opinion-switch:${session.user.id}`, RATE_RULES.opinionSwitch);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const { artifactType, artifactId, stance } = parsed.data;
  if (!(await artifactIsReactable(artifactType, artifactId))) {
    return apiError(404, 'artifact_not_found', 'That page is no longer accepting reactions.');
  }

  const outcome = await switchOpinion({ userId: session.user.id, artifactType, artifactId, stance });

  if (outcome.status === 'final') {
    return apiError(403, 'opinion_final', 'A position on a Story is final and cannot be changed.');
  }
  if (outcome.status === 'no_opinion') {
    return apiError(409, 'no_opinion', 'You have not taken a side on this yet. Your first reaction takes one.');
  }

  return NextResponse.json({
    switched: outcome.status === 'switched',
    totals: outcome.totals,
    contribution: outcome.contribution,
  });
}
