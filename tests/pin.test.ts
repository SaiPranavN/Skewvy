import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, pinAlgorithm } from '@/lib/services/pin';
import { pinSchema } from '@/lib/validation/schemas';

describe('PIN hashing', () => {
  it('never stores the PIN in the hash', async () => {
    const pin = 'my-secret-pin-42';
    const hash = await hashPin(pin);
    expect(hash).not.toContain(pin);
    expect(hash.length).toBeGreaterThan(30);
  });

  it('uses a slow, salted algorithm — the same PIN hashes differently each time', async () => {
    const [first, second] = await Promise.all([hashPin('repeat-me-99'), hashPin('repeat-me-99')]);
    expect(first).not.toEqual(second);
    expect(pinAlgorithm()).toMatch(/argon2id|scrypt/);
  });

  it('verifies the correct PIN and rejects a wrong one', async () => {
    const hash = await hashPin('correct-horse-1');
    await expect(verifyPin(hash, 'correct-horse-1')).resolves.toBe(true);
    await expect(verifyPin(hash, 'correct-horse-2')).resolves.toBe(false);
    await expect(verifyPin(hash, '')).resolves.toBe(false);
  });

  it('treats a malformed hash as a failed verification rather than throwing', async () => {
    await expect(verifyPin('not-a-real-hash', 'anything')).resolves.toBe(false);
    await expect(verifyPin('$scrypt$bad$parts', 'anything')).resolves.toBe(false);
  });

  it('round-trips the scrypt fallback format', async () => {
    // Force the fallback path by hashing a scrypt-format value directly.
    const { scryptSync, randomBytes } = await import('node:crypto');
    const salt = randomBytes(16);
    const derived = scryptSync('fallback-pin-7', salt, 64, { N: 2 ** 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 });
    const hash = `$scrypt$${2 ** 15}$${salt.toString('base64')}$${derived.toString('base64')}`;

    await expect(verifyPin(hash, 'fallback-pin-7')).resolves.toBe(true);
    await expect(verifyPin(hash, 'fallback-pin-8')).resolves.toBe(false);
  });
});

describe('PIN policy', () => {
  it('requires at least six characters', () => {
    expect(pinSchema.safeParse('12345').success).toBe(false);
    expect(pinSchema.safeParse('914273').success).toBe(true);
  });

  it('rejects repeated and sequential PINs', () => {
    expect(pinSchema.safeParse('111111').success).toBe(false);
    expect(pinSchema.safeParse('123456').success).toBe(false);
    expect(pinSchema.safeParse('000000').success).toBe(false);
  });

  it('accepts letters as well as digits', () => {
    expect(pinSchema.safeParse('eggs4life').success).toBe(true);
  });
});
