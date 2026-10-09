/**
 * Formatting and palette constants shared by server and client components.
 *
 * This module must stay free of "use client": anything imported from a client
 * module becomes a client reference and cannot be read on the server.
 */

import { CURRENCY } from "./siteConfig";

export type FormatKind = "number" | "currency" | "compact" | "plain";

const RWF = new Intl.NumberFormat(CURRENCY.locale, {
  style: "currency",
  currency: CURRENCY.code,
  maximumFractionDigits: 0,
});
const RWF_PENCE = new Intl.NumberFormat(CURRENCY.locale, {
  style: "currency",
  currency: CURRENCY.code,
});
const PLAIN = new Intl.NumberFormat("en-GB");
const COMPACT = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Resolve a format key to a formatted string. Shared by charts and tables. */
export function formatValue(value: number, kind: FormatKind = "number"): string {
  switch (kind) {
    case "currency":
      return RWF.format(value);
    case "compact":
      return COMPACT.format(value);
    case "plain":
      return String(value);
    default:
      return PLAIN.format(value);
  }
}

export const MONEY = RWF;
export const MONEY_PENCE = RWF_PENCE;
export const PLAIN_NUMBER = PLAIN;

export function formatMoney(value: number | string): string {
  return RWF.format(Number(value));
}

export function formatMoneyPence(value: number | string): string {
  return RWF_PENCE.format(Number(value));
}

/** Palettes for donuts and status chips. */
export const CHART_COLORS = [
  "var(--color-sage)",
  "var(--color-terracotta)",
  "var(--color-espresso)",
  "var(--color-sage-light)",
  "var(--color-cream-dark)",
];

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${formatDate(d)}, ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
