import { z } from "zod";
import { checkRwandanPhone } from "./phone";
import { PAYMENT_METHODS, type PaymentMethodId } from "./siteConfig";

/**
 * The checkout contract, validated on the client for instant feedback and again
 * on the server, which is the copy that actually matters.
 *
 * Nothing in here is trusted downstream: prices are never part of the payload -
 * only product ids and quantities - so the order total is always rebuilt from
 * the database (see `lib/pricing.ts`).
 */

/** Payment ids as a zod enum tuple, derived from the single config list. */
const PAYMENT_IDS = PAYMENT_METHODS.map((m) => m.id) as [
  PaymentMethodId,
  ...PaymentMethodId[],
];

export const FIELD_MESSAGES = {
  full_name: "Tell us the name for the order",
  phone: "Use a Rwandan mobile number starting 07, e.g. 0784088929",
  email: "That email address does not look right",
  district: "Tell us the district",
  sector: "Tell us the sector",
  landmark: "Add a street or a landmark so we can find you",
  note: "That note is too long",
  payment_method: "Choose how you would like to pay",
  items: "Your cart is empty",
} as const;

export type FieldName = keyof typeof FIELD_MESSAGES;

/**
 * Collapse a Zod issue path to the name the form uses, so an error lands beside
 * the input the customer can actually fix.
 *
 * Zod reports `["customer", "phone"]` and `["items", 0, "quantity"]`. The first
 * is a prefixed field, the second is a line item - both collapse onto the plain
 * field name the checkout form keys its messages by.
 */
function toFieldName(path: PropertyKey[]): FieldName | null {
  const [head, second] = path;
  if (typeof head !== "string") return null;

  // ["customer", "phone"] -> "phone"; ["items", 0, ...] -> "items".
  const name = head === "customer" || head === "delivery" ? second : head;
  return typeof name === "string" && name in FIELD_MESSAGES ? (name as FieldName) : null;
}

/** Trim, collapse internal whitespace and bound a free-text field. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(z.string().max(max));

const phoneField = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.phone)
  .max(32, FIELD_MESSAGES.phone)
  .refine((value) => checkRwandanPhone(value).ok, { message: FIELD_MESSAGES.phone });

/**
 * An optional email.
 *
 * `.nullish()` is applied *after* the transform on purpose: in Zod 4, wrapping a
 * pipe in `.optional()` short-circuits nothing - an absent value still falls
 * through to the inner string schema and is rejected as `undefined`. Putting the
 * nullish wrapper last lets the transform turn `undefined` into `null` itself.
 */
const optionalEmail = z
  .string()
  .trim()
  .max(255, FIELD_MESSAGES.email)
  .refine(
    (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    { message: FIELD_MESSAGES.email },
  )
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null);

/** Same ordering rule as `optionalEmail`: optional wrapper outermost. */
const optionalNote = z
  .string()
  .trim()
  .max(1000, FIELD_MESSAGES.note)
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null);

export const checkoutSchema = z.object({
  customer: z.object({
    full_name: text(150).pipe(z.string().min(2, FIELD_MESSAGES.full_name)),
    phone: phoneField,
    email: optionalEmail,
  }),
  delivery: z.object({
    district: text(100).pipe(z.string().min(2, FIELD_MESSAGES.district)),
    sector: text(100).pipe(z.string().min(2, FIELD_MESSAGES.sector)),
    landmark: text(255).pipe(z.string().min(3, FIELD_MESSAGES.landmark)),
    /** Optional - custom sizes, timber choice, a gate colour… */
    note: optionalNote,
  }),
  payment_method: z.enum(PAYMENT_IDS, { message: FIELD_MESSAGES.payment_method }),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().nullable(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, FIELD_MESSAGES.items)
    .max(50, "Too many items in one order"),
});

export type CheckoutPayload = z.infer<typeof checkoutSchema>;

/** Validate a raw body, returning either the payload or per-field messages. */
export function validateCheckout(
  body: unknown,
): { ok: true; data: CheckoutPayload } | { ok: false; fields: Partial<Record<FieldName, string>> } {
  const parsed = checkoutSchema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fields: Partial<Record<FieldName, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = toFieldName(issue.path);
    if (!key) continue;
    // First message per field wins - the topmost issue is the most specific.
    if (!fields[key]) fields[key] = issue.message;
  }
  return { ok: false, fields };
}