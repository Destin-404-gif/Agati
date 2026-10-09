import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Optimistic route guard plus CSRF origin check.
 *
 * This runs on the Edge runtime, so it must stay free of `pg` and any Node
 * built-ins. It only checks that the session cookie is a valid, unexpired JWT
 * and redirects otherwise. Real authorization (active account, role, per-row
 * permission) happens in the server components and API routes via
 * `requireStaff()` / `requirePermission()`.
 *
 * CSRF: the session cookie is `SameSite=Lax`, which already stops cross-site
 * POSTs from carrying credentials. This adds the missing half - an `Origin`
 * check on every state-changing admin request, because a same-site subdomain or
 * a browser quirk can still slip a request through.
 */

const SESSION_COOKIE = "agati_admin_session";

/** Methods that change state and therefore need a same-origin `Origin`. */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The Origin header must match the host the request arrived on. Browsers always
 * send Origin on cross-origin POSTs and omit it on same-origin GETs, so a
 * missing Origin on an unsafe method means a non-browser client (curl, the seed
 * scripts), which cannot be a CSRF victim either.
 */
function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!host) return false;
    return parsed.host === host;
  } catch {
    return false;
  }
}

const PUBLIC_PAGE = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
const PUBLIC_API = [
  "/api/admin/auth/login",
  "/api/admin/auth/logout",
  "/api/admin/auth/forgot",
  "/api/admin/auth/reset",
];

function key(): Uint8Array | null {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) return null;
  return new TextEncoder().encode(value);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (UNSAFE_METHODS.has(request.method) && !originAllowed(request)) {
    if (isApi) {
      return NextResponse.json(
        { error: "Cross-origin request blocked." },
        { status: 403, headers: { "x-csrf-blocked": "1" } },
      );
    }
    return new NextResponse("Cross-origin request blocked.", { status: 403 });
  }

  if (PUBLIC_API.includes(pathname) || PUBLIC_PAGE.includes(pathname)) {
    return NextResponse.next();
  }

  const secret = key();
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  let valid = false;
  if (secret && token) {
    try {
      await jwtVerify(token, secret, { algorithms: ["HS256"] });
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (valid) return NextResponse.next();

  if (isApi) {
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401, headers: { "x-admin-guard": "1" } },
    );
  }

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
