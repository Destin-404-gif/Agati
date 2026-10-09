import { z } from "zod";
import { PRODUCT_STATUSES } from "./admin-nav";

/**
 * Shared Zod schemas. The same schema validates on the client and the server, so
 * a rule only ever exists once.
 */

const optionalText = z
  .string()
  .trim()
  .max(2000, "Keep this under 2000 characters.")
  .optional()
  .or(z.literal(""));

/**
 * The category select posts `""` for its "Uncategorised" option. `z.coerce.number()`
 * turns that into 0, which then fails `.positive()` - so an optional field that
 * the admin deliberately left blank rejected the whole save. Normalising blank
 * (and missing) values to `null` up front means "no category" is expressible.
 */
const optionalId = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : value),
  z.coerce
    .number("Pick a category from the list.")
    .int("Pick a category from the list.")
    .positive("Pick a category from the list.")
    .nullable(),
);

const requiredCategoryId = z.coerce
  .number("Choose a category.")
  .int("Choose a category.")
  .positive("Choose a category.");

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the product a name.")
    .max(150, "Names are limited to 150 characters."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by dashes.")
    .max(150)
    .optional()
    .or(z.literal("")),
  description: optionalText,
  price: z.coerce
    .number("Enter a price.")
    .min(0, "Price cannot be negative.")
    .max(1_000_000, "That price looks too high."),
  categoryId: requiredCategoryId,
  subcategoryId: optionalId,
  placements: z
    .array(
      z.object({
        navbar: z.enum(["top_bar", "category_bar"]),
        navItemId: z.coerce.number().int().positive("Choose a menu item."),
        megaSectionId: optionalId,
      }),
    )
    .max(12, "Up to 12 product placements.")
    .optional(),
  stockQuantity: z.coerce
    .number("Enter a stock quantity.")
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative.")
    .max(1_000_000),
  status: z.enum(PRODUCT_STATUSES).default("active"),
  isNew: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  images: z
    .array(z.object({ url: z.string().trim().min(1).max(500) }))
    .max(12, "Up to 12 images per product.")
    .default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

export const orderStatusSchema = z.object({
  status: z.enum(STATUSES, { message: "Pick a valid status." }),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const QUOTE_STATUSES = [
  "new",
  "quoted",
  "replied",
  "accepted",
  "rejected",
  "closed",
] as const;

export const quoteStatusSchema = z.object({
  status: z.enum(QUOTE_STATUSES, { message: "Pick a valid status." }),
});

export const quoteNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something first.")
    .max(4000, "Keep notes under 4000 characters."),
});

export const customerSchema = z.object({
  fullName: z.string().trim().max(150).optional().or(z.literal("")),
  email: z.email("Enter a valid email address."),
});

export const staffSchema = z.object({
  email: z.email("Enter a valid email address."),
  fullName: z.string().trim().max(150).optional().or(z.literal("")),
  roleId: z.coerce.number().int().positive("Choose a role."),
  isActive: z.boolean().default(true),
  password: z
    .string()
    .min(8, "Passwords are at least 8 characters.")
    .max(200)
    .optional()
    .or(z.literal("")),
});

export const bannerSchema = z.object({
  title: z.string().trim().min(1, "Give the banner a title.").max(150),
  subtitle: optionalText,
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  linkUrl: z.string().trim().max(500).optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
});

export const pageSchema = z.object({
  title: z.string().trim().min(1, "Give the page a title.").max(150),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by dashes."),
  body: z.string().max(50_000).optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Give the announcement a title.").max(150),
  body: optionalText,
  linkUrl: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const settingsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

/** Field-key -> message, for rendering errors next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Turns a slug into a URL-safe value. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}
