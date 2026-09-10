import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Opaque high-entropy secret for session cookies and one-time email links. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Session and email tokens are stored only as SHA-256 digests. They are already
 * high-entropy random values, so a fast digest is correct here — unlike PINs,
 * which are low-entropy and need the slow hash in `pin.ts`.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** IP addresses are never stored raw; only a peppered digest is kept. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const pepper = process.env.IP_HASH_PEPPER || 'skewvy-dev-pepper';
  return createHash('sha256').update(`${pepper}:${ip}`).digest('hex').slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function newId(): string {
  return crypto.randomUUID();
}
