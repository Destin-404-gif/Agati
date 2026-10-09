import { query } from "./db";

/**
 * Fixed-window rate limiter held in memory. Good enough for a single node; the
 * login flow also writes every attempt to `login_attempts` so a persistent
 * record exists regardless of which instance handled it.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);

  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

// Keep the map from growing without bound on a long-running server.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  timer.unref?.();
}

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip");
}

export async function recordLoginAttempt(
  email: string | null,
  ip: string | null,
  success: boolean,
): Promise<void> {
  try {
    await query(
      "INSERT INTO login_attempts (email, ip, success) VALUES ($1, $2, $3)",
      [email, ip, success],
    );
  } catch {
    // Never fail a login because the attempt log is unavailable.
  }
}

/** Failed attempts for an identity inside the recent window. */
export async function recentFailures(
  email: string,
  windowMinutes = 15,
): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM login_attempts
      WHERE LOWER(email) = LOWER($1)
        AND success = FALSE
        AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [email, String(windowMinutes)],
  );
  return Number(rows[0]?.count ?? 0);
}
