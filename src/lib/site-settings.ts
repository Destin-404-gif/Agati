import { query } from "./db";

/**
 * Server-side reads of site settings for the storefront.
 *
 * The setting *schema* lives with the admin API (`app/api/admin/settings/_shared`),
 * which owns validation; this module only reads the handful of values a public
 * page needs, with the same defaults, so a missing row never breaks a page.
 */

/** Whether the gallery viewer offers a Download button. Defaults to on. */
export async function isGalleryDownloadAllowed(): Promise<boolean> {
  try {
    const rows = await query<{ value: unknown }>(
      "SELECT value FROM settings WHERE key = 'gallery.allow_download'",
      [],
    );
    if (rows.length === 0) return true;
    return rows[0].value !== false && rows[0].value !== "false";
  } catch {
    // A database hiccup must not take the gallery down; show the button.
    return true;
  }
}