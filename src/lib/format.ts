import { CURRENCY } from "./siteConfig";

/**
 * Storefront money. Prices are held and quoted in Rwandan francs, so there is a
 * single formatter for the whole site and one place (`CURRENCY` in
 * `siteConfig`) to change it.
 */
export const CURRENCY_FORMATTER = new Intl.NumberFormat(CURRENCY.locale, {
  style: "currency",
  currency: CURRENCY.code,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Accepts the string numerics that Postgres NUMERIC comes back as. */
export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return CURRENCY_FORMATTER.format(Number.isFinite(n) && n >= 0 ? n : 0);
}

/** Bare figure, no symbol - for table columns and WhatsApp messages. */
export function amount(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(CURRENCY.locale, { maximumFractionDigits: 0 }).format(
    Number.isFinite(n) && n >= 0 ? n : 0,
  );
}