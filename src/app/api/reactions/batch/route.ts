import { NextResponse, type NextRequest } from 'next/server';
import { reactionBatchSchema } from '@/lib/validation/schemas';
import { applyReactionBatch, artifactIsReactable } from '@/lib/services/reactions';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';

/**
 * The batch reaction endpoint.
 *
 * Order matters: authenticate, validate, rate-limit, then apply. The batch is
 * idempotent on `(user_id, clientBatchId)`, so a client retry after a timeout
 * returns the same authoritative totals instead of double-counting.
 */
export async function POST(request: NextRequest) {
  const { ip } = requestContext(request);

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return apiError(401, 'unauthenticated', 'Sign in to send reactions. Your taps are saved until you do.');
  }

  const parsed = reactionBatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const { artifactType, artifactId, reactionType, quantity, clientBatchId } = parsed.data;

  // Two limits: one on request rate, one on total reaction volume per minute.
  const requestLimit = await consumeRateLimit(`reactions:${session.user.id}`, RATE_RULES.reactionBatch);
  if (!requestLimit.allowed) return rateLimited(requestLimit.retryAfterSeconds);

  const volumeKey = `reaction-volume:${session.user.id}`;
  let volume = { allowed: true, retryAfterSeconds: 0 };
  for (let index = 0; index < quantity; index += 25) {
    volume = await consumeRateLimit(volumeKey, RATE_RULES.reactionQuantity);
  }
  if (!volume.allowed) return rateLimited(volume.retryAfterSeconds);

  if (!(await artifactIsReactable(artifactType, artifactId))) {
    return apiError(404, 'artifact_not_found', 'That page is no longer accepting reactions.');
  }

  const result = await applyReactionBatch({
    userId: session.user.id,
    artifactType,
    artifactId,
    reactionType,
    quantity,
    clientBatchId,
  });

  void ip;

  // A side, once taken, is final. Contradicting batches are refused and the
  // caller is told which stance it is held to, so the UI can lock the control.
  if (result.lockedTo) {
    return NextResponse.json(
      {
        error: 'opinion_locked',
        message:
          result.lockedTo === 'negative'
            ? 'You already reacted critically to this. You can keep sending Rotten Eggs, but not Medals.'
            : 'You already reacted appreciatively to this. You can keep awarding Medals, but not Rotten Eggs.',
        lockedTo: result.lockedTo,
        totals: result.totals,
        contribution: result.contribution,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    applied: result.applied,
    totals: result.totals,
    contribution: result.contribution,
    stance: result.stance,
  });
}
