import { z } from "zod";

/** Category helpers shared by the collection route and the [id] route. */

export const categoryInput = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Keep the name short."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single dashes only.",
    ),
  image_url: z.string().trim().max(2000).optional().or(z.literal("")),
  image_alt: z.string().trim().max(300, "Keep alt text under 300 characters.").optional().or(z.literal("")),
});

export type CategoryInput = z.infer<typeof categoryInput>;

/** Subcategory payloads: same shape, plus the parent and ordering. */
export const subcategoryInput = z.object({
  categoryId: z.coerce.number().int().positive("Choose a parent category."),
  name: z.string().trim().min(1, "Name is required.").max(100, "Keep the name short."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and single dashes only.",
    ),
  image_url: z.string().trim().max(2000).optional().or(z.literal("")),
  image_alt: z.string().trim().max(300, "Keep alt text under 300 characters.").optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

export type SubcategoryInput = z.infer<typeof subcategoryInput>;

export function toCategoryCsv(): string {
  return `SELECT c.id, c.name, c.slug, c.image_url, c.image_alt, c.created_at,
            (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id)
              AS product_count
          FROM categories c
         ORDER BY c.name`;
}
