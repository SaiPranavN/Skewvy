import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
}

export function apiError(
  status: number,
  error: string,
  message: string,
  extra: Partial<ApiError> = {},
): NextResponse<ApiError> {
  return NextResponse.json({ error, message, ...extra }, { status });
}

/** Turns a Zod failure into per-field messages the forms can render inline. */
export function validationError(error: ZodError): NextResponse<ApiError> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!fields[key]) fields[key] = issue.message;
  }
  return apiError(422, 'validation_failed', 'Some details need another look.', { fields });
}

export function rateLimited(retryAfterSeconds: number): NextResponse<ApiError> {
  const response = apiError(429, 'rate_limited', 'Too many attempts. Try again shortly.', { retryAfterSeconds });
  response.headers.set('retry-after', String(retryAfterSeconds));
  return response;
}
