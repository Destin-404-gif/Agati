import { z } from "zod";

/** Staff input rules shared by the collection route and the [id] route. */

export const staffInput = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  full_name: z.string().trim().max(150).optional().or(z.literal("")),
  role_slug: z
    .string()
    .trim()
    .min(1, "Pick a role.")
    .max(60)
    .default("staff"),
  is_active: z.boolean().default(true),
  /** Only required when creating a staff member. */
  password: z.string().min(10, "Use at least 10 characters.").max(200).optional(),
});

export type StaffInput = z.infer<typeof staffInput>;

/** Creating a staff member always requires a password. */
export const staffCreate = staffInput.extend({
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

export type StaffCreate = z.infer<typeof staffCreate>;

/** The editable subset used by PATCH. */
export const staffPatch = staffInput.partial().extend({
  password: z.string().min(10, "Use at least 10 characters.").max(200).optional(),
});

export type StaffPatch = z.infer<typeof staffPatch>;
