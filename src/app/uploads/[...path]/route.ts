import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/media-upload";

export const dynamic = "force-dynamic";

/**
 * Serves admin-uploaded images from `storage/uploads` at their public
 * `/uploads/...` path.
 *
 * This route exists because `public/` cannot hold user uploads. `next start`
 * enumerates the public folder once at boot and memoises the misses, so a file
 * written afterwards is a 404 until the server restarts - which is every upload,
 * since they are created by the already-running server. Reading from disk per
 * request also keeps uploads working where the filesystem is ephemeral and
 * `public/` is rebuilt on every deploy.
 *
 * Only the formats `storeUpload` can produce are served, so a file that reached
 * the directory by any other route cannot be fetched from the app's own origin.
 */

const CONTENT_TYPES = new Map<string, string>([
  [".avif", "image/avif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

/** Matches every name `safeBase()` plus an extension can produce. */
const SAFE_NAME = /^[\w-]+(?:\.[\w-]+)*$/;

const NOT_FOUND = () => new Response(null, { status: 404 });

/**
 * Resolves a request path to a file inside the upload directory, or null when it
 * is not a plain generated filename. `.` and `..` never match `SAFE_NAME`, so no
 * traversal string is ever joined; the resolved path is re-checked against the
 * directory anyway as a second line of defence.
 */
function resolveUpload(segments: string[]): string | null {
  if (
    segments.length < 1 ||
    segments.some((name) => name !== path.basename(name) || !SAFE_NAME.test(name))
  ) return null;

  const root = path.resolve(UPLOAD_DIR);
  const file = path.resolve(root, ...segments);
  if (!file.startsWith(root + path.sep)) return null;
  return file;
}

async function serve(
  segments: string[],
  method: "GET" | "HEAD",
  ifNoneMatch: string | null,
): Promise<Response> {
  const file = resolveUpload(segments);
  if (!file) return NOT_FOUND();

  const contentType = CONTENT_TYPES.get(path.extname(file).toLowerCase());
  if (!contentType) return NOT_FOUND();

  let info;
  try {
    info = await stat(file);
  } catch {
    return NOT_FOUND();
  }
  if (!info.isFile()) return NOT_FOUND();

  // A name is unique per upload and is never rewritten, so the bytes behind a URL
  // are fixed for good and a long immutable cache is safe.
  const etag = `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(info.size),
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  if (contentType === "image/svg+xml") {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }

  if (method === "HEAD") return new Response(null, { status: 200, headers });

  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    return NOT_FOUND();
  }
  return new Response(new Uint8Array(body), { status: 200, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path: segments } = await params;
  return serve(segments, "GET", request.headers.get("if-none-match"));
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path: segments } = await params;
  return serve(segments, "HEAD", request.headers.get("if-none-match"));
}
