import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { handleDbError } from "./api";
import { CSRF_PROTECTED_METHODS, CsrfError, assertSameOrigin } from "./csrf";
import { clientIp } from "./rate-limit";
import {
  AuthError,
  getCurrentStaff,
  requirePermission,
  requireStaff,
  type StaffWithPermissions,
} from "./staff";

export interface RouteContext<TParams> {
  req: NextRequest;
  staff: StaffWithPermissions;
  params: TParams;
  ip: string | null;
}

type Handler<TParams> = (ctx: RouteContext<TParams>) => Promise<Response>;

export interface RouteOptions {
  /** All listed permissions are OR-ed. Super Admin always passes. */
  permissions?: string[];
  /** Resolve the staff member without throwing on anonymous requests. */
  allowAnonymous?: boolean;
  /**
   * Skip the same-origin check on a state-changing request. Only for routes that
   * are legitimately called from somewhere other than this app - a webhook, or a
   * one-shot maintenance script. Everything in the admin UI is same-origin, so
   * leaving this off is almost always right.
   */
  skipCsrf?: boolean;
}

/**
 * Wraps a route handler with staff resolution, permission checks, CSRF defence
 * and uniform error mapping (auth -> 401/403, csrf -> 403, zod -> 400,
 * postgres -> sane status).
 */
export function withAuth<TParams = Record<string, string>>(
  handler: Handler<TParams>,
  options: RouteOptions = {},
): (req: NextRequest, ctx: { params: Promise<TParams> }) => Promise<Response> {
  return async (req, ctx) => {
    try {
      // Checked before the session is resolved: a cross-site write should be
      // refused whether or not the browser happened to attach the cookie.
      if (!options.skipCsrf && CSRF_PROTECTED_METHODS.has(req.method.toUpperCase())) {
        assertSameOrigin(req);
      }

      let staff: StaffWithPermissions | null;
      if (options.allowAnonymous) {
        staff = await getCurrentStaff();
      } else if (options.permissions?.length) {
        staff = await requirePermission(...options.permissions);
      } else {
        staff = await requireStaff();
      }

      const params = (ctx?.params ? await ctx.params : {}) as TParams;
      return await handler({
        req,
        staff: staff as StaffWithPermissions,
        params,
        ip: clientIp(req.headers),
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof CsrfError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fields: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }
  if (err instanceof Response) return err;

  if (process.env.NODE_ENV !== "production") {
    const e = err as Error;
    return NextResponse.json(
      {
        error: "Internal server error",
        debug: { message: e?.message, stack: String(e?.stack ?? "").split("\n").slice(0, 6) },
      },
      { status: 500 },
    );
  }

  return handleDbError(err);
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ZodError([
      { code: "custom", path: [], message: "Expected a JSON body." },
    ]);
  }
  return schema.parse(body);
}

export function readSearch(req: Request): URLSearchParams {
  return new URL(req.url).searchParams;
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  columns: string[],
  rows: Record<string, unknown>[],
): string {
  const head = columns.map(csvEscape).join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
  return [head, ...body].join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
