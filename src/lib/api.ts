import { NextResponse } from "next/server";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Turn Postgres errors into sane HTTP responses without leaking internals. */
export function handleDbError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;

  if (code === "23505") {
    return badRequest("That record already exists");
  }
  if (code === "23503") {
    return badRequest("Referenced record does not exist");
  }
  if (code === "22P02" || code === "23514") {
    return badRequest("Invalid value supplied");
  }
  if (code === "ECONNREFUSED" || code === "57P03" || code === "ENOTFOUND") {
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that Postgres is running." },
      { status: 503 },
    );
  }

  console.error("[api] unhandled database error", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Coerce an unknown request field to a positive integer. */
export function positiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

/** Read a boolean from a query-string value ("true" / "1"). */
export function boolParam(value: string | null): boolean {
  return value === "true" || value === "1";
}
