/**
 * Server-side link resolution: turn a link that points at a *page* into a
 * direct image URL where possible.
 *
 * `image-link.ts` stays free of network calls so the same checks run in the
 * browser preview; this module is the server half. Today it handles Pinterest:
 * a pin page (`pinterest.com/pin/<id>/` or a `pin.it` short link) does not
 * render in an `<img>`, so the save path fetches the page and reads its
 * `og:image`, which is an `i.pinimg.com` address that hotlinks indefinitely.
 *
 * Imported only by API routes (Node runtime), so it may use the global `fetch`.
 */

import { isPinterestLink, normalizeImageUrl } from "./image-link";

const TIMEOUT_MS = 8000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Group 1 is the image URL in both spellings Pinterest uses in its meta tags. */
const META_PROPERTY_FIRST =
  /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/gi;
const META_CONTENT_FIRST =
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["']/gi;

/** Validate and de-entity an extracted meta URL. */
function cleanMetaUrl(raw: string): string | null {
  const value = raw.trim().replace(/&amp;/g, "&");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Fetch a Pinterest page and return its direct pin image, or null when the page
 * cannot be reached, does not declare an image, or the link is not Pinterest.
 */
export async function resolvePinterestImage(link: string): Promise<string | null> {
  if (!isPinterestLink(link)) return null;

  let res: Response;
  try {
    res = await fetch(link, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const html = await res.text().catch(() => "");
  for (const re of [META_PROPERTY_FIRST, META_CONTENT_FIRST]) {
    for (const match of html.matchAll(re)) {
      const url = cleanMetaUrl(match[1] ?? "");
      if (url) return url;
    }
  }
  return null;
}

/**
 * The value to actually store for a pasted link.
 *
 * Runs the same Drive rewrite as `normalizeImageUrl`, then, for Pinterest
 * links, swaps the page address for the pin's direct image. Anything else is
 * stored untouched. Never throws: a failed/fetched-URL resolution falls back to
 * the original link so an admin save never breaks.
 */
export async function resolveImageLink(raw: string | null | undefined): Promise<string> {
  const base = normalizeImageUrl(raw);
  if (!base) return "";
  if (!isPinterestLink(base)) return base;
  const direct = await resolvePinterestImage(base);
  return direct ?? base;
}