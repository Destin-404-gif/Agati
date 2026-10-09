import { z } from "zod";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** One API serving the three content tables. `type` selects the collection. */

export const CONTENT_TYPES = ["banners", "pages", "announcements"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

const bannerInput = z.object({
  title: z.string().trim().min(1, "Title is required.").max(150),
  subtitle: z.string().trim().max(2000).optional().or(z.literal("")),
  image_url: z.string().trim().max(2000).optional().or(z.literal("")),
  link_url: z.string().trim().max(2000).optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().trim().optional().or(z.literal("")),
  ends_at: z.string().trim().optional().or(z.literal("")),
});

const pageInput = z.object({
  title: z.string().trim().min(1, "Title is required.").max(150),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(150)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single dashes only.",
    ),
  body: z.string().max(200000).optional().or(z.literal("")),
  is_published: z.boolean().default(false),
});

const announcementInput = z.object({
  title: z.string().trim().min(1, "Title is required.").max(150),
  body: z.string().trim().max(5000).optional().or(z.literal("")),
  link_url: z.string().trim().max(2000).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export const contentInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("banners"), body: bannerInput }),
  z.object({ type: z.literal("pages"), body: pageInput }),
  z.object({ type: z.literal("announcements"), body: announcementInput }),
]);

export interface ContentRow {
  id: number;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  slug: string | null;
  position: number | null;
  is_active: boolean | null;
  is_published: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string | null;
}

const SELECTS: Record<ContentType, string> = {
  banners: `b.id, b.title, b.subtitle, NULL::text AS body, b.image_url, b.link_url,
                  NULL::text AS slug, b.position, b.is_active, NULL::boolean AS is_published,
                  b.starts_at, b.ends_at, b.created_at, NULL::timestamp AS updated_at`,
  pages: `p.id, p.title, NULL::text AS subtitle, p.body, NULL::text AS image_url,
                 NULL::text AS link_url, p.slug, NULL::integer AS position,
                 NULL::boolean AS is_active, p.is_published,
                 NULL::timestamp AS starts_at, NULL::timestamp AS ends_at,
                 p.updated_at AS created_at, p.updated_at`,
  announcements: `a.id, a.title, NULL::text AS subtitle, a.body, NULL::text AS image_url,
                          a.link_url, NULL::text AS slug, NULL::integer AS position,
                          a.is_active, NULL::boolean AS is_published,
                          NULL::timestamp AS starts_at, NULL::timestamp AS ends_at,
                          a.created_at, NULL::timestamp AS updated_at`,
};

const ORDER = {
  banners: "b.position, b.id DESC",
  pages: "p.title",
  announcements: "a.is_active DESC, a.created_at DESC, a.id DESC",
} as const;

const TABLE = {
  banners: "banners",
  pages: "pages",
  announcements: "announcements",
} as const;

/**
 * Row alias. The column lists in `SELECTS` and the sorts in `ORDER` are all
 * written against these one-letter names, so the `FROM` has to introduce them.
 */
const ALIAS = {
  banners: "b",
  pages: "p",
  announcements: "a",
} as const;

export function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

export async function listContent(type: ContentType): Promise<ContentRow[]> {
  const rows = await query<ContentRow>(
    `SELECT ${SELECTS[type]} FROM ${TABLE[type]} ${ALIAS[type]} ORDER BY ${ORDER[type]}`,
  );
  return rows;
}

/** Normalise a validated payload into column values for INSERT/UPDATE. */
export function contentColumns(type: ContentType, body: Record<string, unknown>) {
  if (type === "banners") {
    const b = body as z.infer<typeof bannerInput>;
    return {
      title: b.title,
      subtitle: b.subtitle || null,
      image_url: b.image_url || null,
      link_url: b.link_url || null,
      position: b.position,
      is_active: b.is_active,
      starts_at: b.starts_at || null,
      ends_at: b.ends_at || null,
    };
  }
  if (type === "pages") {
    const p = body as z.infer<typeof pageInput>;
    return {
      title: p.title,
      slug: p.slug.trim().toLowerCase(),
      body: p.body || null,
      is_published: p.is_published,
    };
  }
  const a = body as z.infer<typeof announcementInput>;
  return {
    title: a.title,
    body: a.body || null,
    link_url: a.link_url || null,
    is_active: a.is_active,
  };
}
