import { createRequire } from 'node:module';
import { scrypt as scryptCallback, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** Promisified scrypt that keeps the options overload the callback form has. */
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}
const require = createRequire(import.meta.url);

/**
 * PIN hashing. Argon2id is the intended algorithm; scrypt (also memory-hard and
 * slow) is the fallback when the native module is unavailable on a platform.
 * Raw PINs never leave this module — no return value, log or error carries one.
 */

interface Argon2Module {
  hash(pin: string, options: { algorithm: number; memoryCost: number; timeCost: number; parallelism: number }): Promise<string>;
  verify(hash: string, pin: string): Promise<boolean>;
  Algorithm?: { Argon2id: number };
}

let argon2: Argon2Module | null | undefined;

function loadArgon2(): Argon2Module | null {
  if (argon2 !== undefined) return argon2;
  try {
    argon2 = require('@node-rs/argon2') as Argon2Module;
  } catch {
    argon2 = null;
  }
  return argon2;
}

const ARGON2ID = 2;
const ARGON2_OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 2 ** 15;
const SCRYPT_BLOCK_SIZE = 8;
/**
 * scrypt needs roughly 128 * N * r bytes — about 33 MB at these parameters,
 * which is over Node's 32 MB default and would otherwise fail outright.
 */
const SCRYPT_MAX_MEMORY = 96 * 1024 * 1024;

function scryptOptions(cost: number): ScryptOptions {
  return { N: cost, r: SCRYPT_BLOCK_SIZE, p: 1, maxmem: SCRYPT_MAX_MEMORY };
}

export async function hashPin(pin: string): Promise<string> {
  const argon = loadArgon2();
  if (argon) return argon.hash(pin, ARGON2_OPTIONS);

  const salt = randomBytes(16);
  const derived = await scrypt(pin, salt, SCRYPT_KEYLEN, scryptOptions(SCRYPT_COST));
  return `$scrypt$${SCRYPT_COST}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPin(storedHash: string, pin: string): Promise<boolean> {
  try {
    if (storedHash.startsWith('$scrypt$')) {
      const [, , costRaw, saltRaw, hashRaw] = storedHash.split('$');
      const salt = Buffer.from(saltRaw, 'base64');
      const expected = Buffer.from(hashRaw, 'base64');
      const derived = await scrypt(pin, salt, expected.length, scryptOptions(Number(costRaw)));
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    }

    const argon = loadArgon2();
    if (!argon) return false;
    return await argon.verify(storedHash, pin);
  } catch {
    // A malformed or unsupported hash is a failed verification, never a crash.
    return false;
  }
}

/** Which algorithm is actually in use — surfaced in setup docs and the admin page. */
export function pinAlgorithm(): 'argon2id' | 'scrypt' {
  return loadArgon2() ? 'argon2id' : 'scrypt';
}
