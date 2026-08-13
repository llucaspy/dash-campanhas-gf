import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2:${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [method, iterationsRaw, salt, hash] = storedHash.split(":");
  if (method !== "pbkdf2" || !iterationsRaw || !salt || !hash) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations)) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
