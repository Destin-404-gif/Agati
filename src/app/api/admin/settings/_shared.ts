import { query } from "@/lib/db";

/** The single source of truth for which settings exist and how they validate. */

export interface SettingField {
  key: string;
  label: string;
  kind: "string" | "number" | "boolean" | "secret";
  hint?: string;
  group: string;
  min?: number;
  max?: number;
}

export const SETTINGS_SCHEMA: SettingField[] = [
  {
    key: "gallery.allow_download",
    label: "Allow downloading gallery photos",
    kind: "boolean",
    group: "Gallery",
    hint: "Shows a Download button in the photo viewer. Off hides it; the full-size file still exists.",
  },
  {
    key: "store.name",
    label: "Site name",
    kind: "string",
    group: "Store",
    hint: "Used in emails and the admin header.",
  },
  {
    key: "store.email",
    label: "Contact email",
    kind: "string",
    group: "Store",
    hint: "Shown to customers who need help.",
  },
  {
    key: "store.phone",
    label: "Phone",
    kind: "string",
    group: "Store",
  },
  {
    key: "store.address",
    label: "Address",
    kind: "string",
    group: "Store",
  },
  {
    key: "social.instagram",
    label: "Instagram URL",
    kind: "string",
    group: "Social links",
  },
  {
    key: "social.facebook",
    label: "Facebook URL",
    kind: "string",
    group: "Social links",
  },
  {
    key: "social.pinterest",
    label: "Pinterest URL",
    kind: "string",
    group: "Social links",
  },
  {
    key: "social.linkedin",
    label: "LinkedIn URL",
    kind: "string",
    group: "Social links",
  },
  {
    key: "social.youtube",
    label: "YouTube URL",
    kind: "string",
    group: "Social links",
  },
  {
    key: "smtp.host",
    label: "SMTP host",
    kind: "string",
    group: "Email (SMTP)",
    hint: "For example smtp.example.com.",
  },
  {
    key: "smtp.port",
    label: "SMTP port",
    kind: "number",
    group: "Email (SMTP)",
    min: 1,
    max: 65535,
  },
  {
    key: "smtp.username",
    label: "SMTP username",
    kind: "string",
    group: "Email (SMTP)",
  },
  {
    key: "smtp.password",
    label: "SMTP password",
    kind: "secret",
    group: "Email (SMTP)",
    hint: "Stored hashed-at-rest in the database. Never returned to the browser.",
  },
  {
    key: "smtp.from",
    label: "From address",
    kind: "string",
    group: "Email (SMTP)",
    hint: "The From header on outgoing mail.",
  },
  {
    key: "payments.provider",
    label: "Payment provider",
    kind: "string",
    group: "Payments & API keys",
    hint: "For example stripe, paystack or none.",
  },
  {
    key: "payments.secret_key",
    label: "Payment secret key",
    kind: "secret",
    group: "Payments & API keys",
    hint: "Never returned to the browser or any public page.",
  },
  {
    key: "payments.webhook_secret",
    label: "Webhook signing secret",
    kind: "secret",
    group: "Payments & API keys",
    hint: "Used to verify payment callbacks.",
  },
  {
    key: "api.public_key",
    label: "Public API key",
    kind: "string",
    group: "Payments & API keys",
    hint: "Safe to show; not a secret.",
  },
  {
    key: "commerce.low_stock_threshold",
    label: "Low stock threshold",
    kind: "number",
    group: "Commerce",
    min: 0,
    max: 1000,
    hint: "Products at or below this are flagged low.",
  },
  {
    key: "commerce.free_shipping_threshold",
    label: "Free shipping over",
    kind: "number",
    group: "Commerce",
    min: 0,
    max: 100000,
  },
  {
    key: "commerce.tax_rate",
    label: "Tax rate (%)",
    kind: "number",
    group: "Commerce",
    min: 0,
    max: 100,
  },
  {
    key: "orders.auto_archive_days",
    label: "Auto-archive orders after (days)",
    kind: "number",
    group: "Orders",
    min: 1,
    max: 3650,
  },
  {
    key: "quotes.notify_email",
    label: "Email me on new quote requests",
    kind: "boolean",
    group: "Quotes",
    hint: "Requires SMTP to be configured.",
  },
  {
    key: "quotes.auto_reply",
    label: "Send an automatic acknowledgement",
    kind: "boolean",
    group: "Quotes",
    hint: "Requires SMTP to be configured.",
  },
];

/** Booleans that are on until an admin turns them off. */
const DEFAULT_TRUE = new Set(["gallery.allow_download"]);

export function settingDefaults(): Record<string, string | number | boolean> {
  const defaults: Record<string, string | number | boolean> = {};
  for (const field of SETTINGS_SCHEMA) {
    if (field.kind === "boolean") defaults[field.key] = DEFAULT_TRUE.has(field.key);
    else if (field.kind === "number") defaults[field.key] = 0;
    else defaults[field.key] = "";
  }
  return defaults;
}

/** Keys whose value must never leave the server. */
export const SECRET_SETTING_KEYS = new Set(
  SETTINGS_SCHEMA.filter((f) => f.kind === "secret").map((f) => f.key),
);

/** Stored values merged over the defaults so the UI always has every key. */
export async function listSettings(): Promise<Record<string, unknown>> {
  const rows = await query<{ key: string; value: unknown }>(
    "SELECT key, value FROM settings ORDER BY key",
  );

  const values: Record<string, unknown> = settingDefaults();
  for (const row of rows) values[row.key] = row.value;
  return values;
}

/**
 * Values safe to send to the browser. Secrets are replaced with a boolean
 * "is it set?" flag so the UI can show "configured" without ever holding the
 * value in memory on the client.
 */
export async function listSettingsForAdmin(): Promise<Record<string, unknown>> {
  const values = await listSettings();
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    safe[key] = SECRET_SETTING_KEYS.has(key) ? Boolean(value) : value;
  }
  return safe;
}
