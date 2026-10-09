/**
 * Cross-site request forgery defence for state-changing admin routes.
 *
 * The admin session cookie is `SameSite=Lax`, which already stops a cross-site
 * form post from carrying it. That is one layer, not the whole answer: Lax still
 * permits a top-level `GET` to carry the cookie, some corporate proxies strip the
 * attribute, and older browsers treat the default differently. An explicit
 * origin check makes the rule "a write must come from this site" true regardless
 * of how the cookie was set.
 *
 * The check is deliberately origin-based rather than token-based: the upload
 * endpoints take `multipart/form-data` from `fetch` and `curl.exe`, and asking
 * both to carry a hidden token would mean threading one through every caller for
 * no gain when the browser already sends an unforgeable `Origin` on every
 * cross-origin attempt.
 */

export class CsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsrfError";
  }
}

/**
 * `true` when the request provably came from this site.
 *
 * Accepts `Origin`, then `Referer` (some older proxies strip `Origin` on
 * same-site navigations), and finally falls back to `Sec-Fetch-Site`, which
 * browsers set on every request and which cannot be set by a page on another
 * site. If none of the three headers is present the request is refused: a genuine
 * same-origin `fetch` from this app always sends at least one, and refusing the
 * ambiguous case fails closed rather than open.
 */
export function isSameOriginRequest(req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin");
  if (origin) return originMatchesHost(origin, host);

  const referer = req.headers.get("referer");
  if (referer) return originMatchesHost(referer, host);

  return req.headers.get("sec-fetch-site") === "same-origin";
}

function originMatchesHost(candidate: string, host: string): boolean {
  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}

/**
 * Guard for a state-changing handler. Throws `CsrfError`, which
 * `toErrorResponse` maps to 403.
 */
export function assertSameOrigin(req: Request): void {
  if (!isSameOriginRequest(req)) {
    throw new CsrfError("This request did not come from the admin site.");
  }
}

/** Methods that change state and therefore need the guard. */
export const CSRF_PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);