import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export type PasswordHash = string;

export async function hashPassword(plain: string): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const salt = Buffer.from(parts[4] ?? "", "hex");
  const expected = Buffer.from(parts[5] ?? "", "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = await scrypt(plain.normalize("NFKC"), salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: MAXMEM,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * The password policy, in one place so the forced change at first login, the
 * change-password form and the reset form cannot drift apart.
 */
const MIN_LENGTH = 10;
const MAX_LENGTH = 200;

/** Passwords that satisfy the length rule but are trivially guessable. */
const TOO_COMMON = new Set([
  "password12",
  "password123",
  "qwerty12345",
  "1234567890",
  "administrator",
  "letmein1234",
  "welcome1234",
  "changeme123",
]);

export function passwordProblem(plain: string): string | null {
  if (plain.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  if (plain.length > MAX_LENGTH) {
    return `Password must be under ${MAX_LENGTH} characters.`;
  }
  if (TOO_COMMON.has(plain.toLowerCase())) {
    return "That password is too easy to guess. Choose something less obvious.";
  }
  // A single repeated character or a straight run is long but has almost no
  // entropy, and both pass a naive length check.
  if (/^(.)\1+$/.test(plain)) {
    return "That password is too easy to guess. Choose something less obvious.";
  }
  if (/^(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(plain)) {
    return "That password is too easy to guess. Choose something less obvious.";
  }
  return null;
}
