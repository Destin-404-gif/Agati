import { badRequest } from "@/lib/api";
import {
  CHAT_RATE,
  CHAT_SESSION_COOKIE,
  CHAT_SESSION_TTL_DAYS,
  isPlausibleSessionId,
} from "@/lib/chat-shared";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Helpers shared by the public chat routes.
 *
 * `_shared` is not a route segment, so Next.js never serves it.
 *
 * The session cookie is the whole notion of identity here. There is no account,
 * so it is deliberately opaque and HttpOnly: a cross-site script cannot read it
 * out of `document.cookie`, and the server is the only thing that needs it.
 */

/** A fresh opaque session handle. 32 hex characters, matching `isPlausibleSessionId`. */
export function newSessionId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** The caller's session, if the cookie holds something we recognise. */
export function readSessionId(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== CHAT_SESSION_COOKIE) continue;
    const value = rest.join("=");
    if (isPlausibleSessionId(value)) return value;
  }
  return null;
}

/**
 * A `Set-Cookie` value for the session.
 *
 * `Secure` is added in production only, so plain-HTTP local testing still works.
 * `SameSite=Lax` keeps the cookie off cross-site requests, which complements the
 * origin check on every write.
 */
export function sessionCookie(sessionId: string): string {
  const maxAge = CHAT_SESSION_TTL_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CHAT_SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export interface RateLimitDecision {
  ok: boolean;
  /** Seconds the visitor should wait, for the 429 body. */
  retryAfterSeconds: number;
}

/**
 * Two ceilings per message: one keyed on the session so a single visitor cannot
 * flood a thread, and one on the address so clearing the cookie does not reset
 * the limit.
 */
export function checkMessageLimits(
  req: Request,
  sessionId: string | null,
): RateLimitDecision {
  const ip = clientIp(req.headers) ?? "unknown";

  const bySession = rateLimit(
    `chat:session:${sessionId ?? "none"}`,
    CHAT_RATE.perSession,
    CHAT_RATE.perSessionWindowMs,
  );
  if (!bySession.ok) return bySession;

  const byIp = rateLimit(
    `chat:ip:${ip}`,
    CHAT_RATE.perIp,
    CHAT_RATE.perIpWindowMs,
  );
  return byIp;
}

/**
 * Honeypot.
 *
 * The form renders a field a person never sees and never fills. A script that
 * posts to the endpoint fills everything, so a non-empty value means a bot. The
 * caller answers as if the message was accepted, so the script learns nothing.
 */
export function isBot(body: Record<string, unknown>): boolean {
  const trap = body.hp;
  return typeof trap === "string" && trap.trim().length > 0;
}

/** Reject once a visitor is over the limit, telling them how long to wait. */
export function tooMany(decision: RateLimitDecision): Response {
  const seconds = Math.max(decision.retryAfterSeconds, 1);
  const res = badRequest("Too many messages just now. Please wait a moment.");
  res.headers.set("Retry-After", String(seconds));
  return res;
}