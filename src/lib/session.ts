import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { query } from "./db";

export const SESSION_COOKIE = "agati_admin_session";

export type StaffRole = "super-admin" | "admin" | "editor" | "staff";

/**
 * `active` is the only state that can sign in. `suspended` blocks sign-in and
 * existing sessions; `invited` has no usable password yet.
 */
export type StaffStatus = "active" | "suspended" | "invited";

export interface SessionPayload {
  staffId: number;
  email: string;
  fullName: string | null;
  role: StaffRole | null;
}

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "JWT_SECRET is missing or too short. Set a 32+ character value in .env.local.",
    );
  }
  return new TextEncoder().encode(value);
}

/**
 * How long a "keep me signed in" cookie lasts. The default session is short;
 * opting into a remembered session is an explicit, visible choice.
 */
const REMEMBER_TTL_SECONDS = 30 * 24 * 60 * 60;

export function sessionTtlSeconds(remember = false): number {
  if (remember) return REMEMBER_TTL_SECONDS;
  const n = Number(process.env.SESSION_TTL ?? 28800);
  return Number.isFinite(n) && n > 300 ? n : 28800;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionMeta {
  ip?: string | null;
  userAgent?: string | null;
  remember?: boolean;
}

/** Signs a JWT and records the matching row in `sessions` so it can be revoked. */
export async function issueSession(
  payload: SessionPayload,
  meta: SessionMeta = {},
): Promise<string> {
  const remember = meta.remember === true;
  const ttl = sessionTtlSeconds(remember);
  const token = await new SignJWT({
    email: payload.email,
    name: payload.fullName,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.staffId))
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret());

  await query(
    `INSERT INTO sessions (staff_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      payload.staffId,
      hashToken(token),
      meta.userAgent ?? null,
      meta.ip ?? null,
      new Date(Date.now() + ttl * 1000),
    ],
  );

  return token;
}

/** Verifies the signature, then confirms the session row still exists. */
export async function readSession(
  token: string | undefined,
): Promise<number | null> {
  if (!token) return null;

  let staffId: number;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    staffId = Number(payload.sub);
    if (!Number.isInteger(staffId)) return null;
  } catch {
    return null;
  }

  const rows = await query<{ staff_id: number }>(
    `SELECT staff_id FROM sessions
      WHERE token_hash = $1 AND expires_at > NOW() AND staff_id = $2`,
    [hashToken(token), staffId],
  );
  return rows.length > 0 ? staffId : null;
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function revokeAllForStaff(staffId: number): Promise<void> {
  await query("DELETE FROM sessions WHERE staff_id = $1", [staffId]);
}

export async function clearExpiredSessions(): Promise<number> {
  const rows = await query<{ id: number }>(
    "DELETE FROM sessions WHERE expires_at <= NOW() RETURNING id",
  );
  return rows.length;
}

export async function setSessionCookie(
  token: string,
  remember = false,
): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds(remember),
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function newResetToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
