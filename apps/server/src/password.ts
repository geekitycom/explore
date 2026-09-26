import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

export type ScryptCost = { N: number; r: number; p: number };

export const SCRYPT_COST: ScryptCost = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, params: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...params, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string, cost = SCRYPT_COST): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, cost);
  const { N, r, p } = cost;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const decoyHashes = new WeakMap<ScryptCost, Promise<string>>();

// Unknown usernames still pay for one scrypt so response time does not reveal which usernames exist.
export async function rejectUnknownUser(password: string, cost = SCRYPT_COST): Promise<false> {
  let decoyHash = decoyHashes.get(cost);
  if (!decoyHash) decoyHashes.set(cost, (decoyHash = hashPassword('decoy-password', cost)));
  await verifyPassword(password, await decoyHash);
  return false;
}
