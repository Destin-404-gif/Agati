"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { money } from "@/lib/format";
import { SITE } from "@/lib/siteConfig";
import { useCart } from "./CartProvider";
import type { PricedLine } from "./CartView";

const field =
  "mt-2 w-full rounded-2xl border border-espresso/15 bg-white px-4 py-3 text-sm text-espresso placeholder:text-espresso/30 focus:border-terracotta focus:outline-none";

const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/50";

/** Rwanda's districts, as the workshop actually delivers to. */
const DISTRICTS = [
  "Musanze",
  "Burera",
  "Gicumbi",
  "Rulindo",
  "Gakenke",
  "Nyabiraba",
] as const;

/**
 * Delivery details and payment choice, then POST /api/orders.
 *
 * The server re-prices the cart from the same ids sent here and rejects the order
 * if anything changed, so the total shown is never taken on trust. On success the
 * cart is emptied and the browser moves to the order's own page.
 */
export default function CheckoutForm() {
  const { items, ready, clear } = useCart();
  const router = useRouter();

  const [priced, setPriced] = useState<{ lines: PricedLine[]; subtotal: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready || items.length === 0) return;
    let ignore = false;

    fetch("/api/cart/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Could not price your cart");
        return data;
      })
      .then((data) => {
        if (!ignore) setPriced(data);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, [items, ready]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const fd = new FormData(form);
    const value = (key: string) => String(fd.get(key) ?? "").trim();

    setSubmitting(true);
    setError(null);
    setFields({});

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
          customer: {
            full_name: value("full_name"),
            phone: value("phone"),
            email: value("email") || null,
          },
          delivery: {
            district: value("district"),
            sector: value("sector"),
            landmark: value("landmark"),
            note: value("note") || null,
          },
          payment_method: value("payment_method"),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "We could not place that order.");
        setFields(data?.details ?? {});
        setSubmitting(false);
        return;
      }

      clear();
      router.push(`/order/${data.order.order_number}`);
    } catch {
      setError("Network problem - please try again.");
      setSubmitting(false);
    }
  }

  if (ready && items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h2 className="font-display text-2xl font-black text-espresso">Nothing to check out</h2>
        <p className="mt-3 text-sm text-espresso/55">
          Your cart is empty, so there is nothing to confirm yet.
        </p>
        <Link
          href="/furniture"
          className="mt-8 inline-flex items-center rounded-full bg-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta"
        >
          Browse the catalogue
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-10 pb-20 lg:grid-cols-[1fr_22rem] lg:items-start"
    >
      <div className="flex flex-col gap-8">
        {/* ------------------------------------------------ who you are */}
        <fieldset className="rounded-[2rem] bg-white p-7 shadow-soft sm:p-8">
          <legend className="text-display text-xl text-espresso">Who should we call?</legend>
          <p className="mt-2 text-sm text-espresso/50">
            A phone number is enough - we confirm every order on WhatsApp.
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="co-name" className={label}>
                Full name
              </label>
              <input
                id="co-name"
                name="full_name"
                required
                maxLength={150}
                autoComplete="name"
                placeholder="Eg. Claude Hirwa"
                aria-invalid={Boolean(fields.full_name)}
                className={field}
              />
              {fields.full_name && (
                <p role="alert" className="mt-1.5 text-xs text-terracotta">
                  {fields.full_name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="co-phone" className={label}>
                Phone number
              </label>
              <input
                id="co-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                required
                maxLength={32}
                autoComplete="tel"
                placeholder="0784088929"
                aria-invalid={Boolean(fields.phone)}
                className={field}
              />
              <p className="mt-1.5 text-xs text-espresso/40">
                Rwandan mobile, e.g. 0784088929 or +250 784 088 929.
              </p>
              {fields.phone && (
                <p role="alert" className="mt-1.5 text-xs text-terracotta">
                  {fields.phone}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="co-email" className={label}>
                Email <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="co-email"
                name="email"
                type="email"
                maxLength={255}
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(fields.email)}
                className={field}
              />
              {fields.email && (
                <p role="alert" className="mt-1.5 text-xs text-terracotta">
                  {fields.email}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* ------------------------------------------------- where it goes */}
        <fieldset className="rounded-[2rem] bg-white p-7 shadow-soft sm:p-8">
          <legend className="text-display text-xl text-espresso">Where is it going?</legend>
          <p className="mt-2 text-sm text-espresso/50">
            Our own delivery team covers Musanze and the northern districts. A landmark
            helps the driver more than a street number.
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="co-district" className={label}>
                District
              </label>
              <select
                id="co-district"
                name="district"
                required
                defaultValue=""
                aria-invalid={Boolean(fields.district)}
                className={`${field} cursor-pointer`}
              >
                <option value="" disabled>
                  Choose a district
                </option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {fields.district && (
                <p role="alert" className="mt-1.5 text-xs text-terracotta">
                  {fields.district}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="co-sector" className={label}>
                Sector
              </label>
              <input
                id="co-sector"
                name="sector"
                required
                maxLength={100}
                placeholder="Cyuve"
                aria-invalid={Boolean(fields.sector)}
                className={field}
              />
              {fields.sector && (
                <p role="alert" className="mt-1.5 text-xs text-terracotta">
                  {fields.sector}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="co-landmark" className={label}>
                Landmark
              </label>
              <input
                id="co-landmark"
                name="landmark"
                required
                maxLength={255}
                placeholder="Opposite the market, blue gate"
                aria-invalid={Boolean(fields.landmark)}
                className={field}
              />
              {fields.landmark && (
                <p role="alert" className="mt-1.5 text-xs text-terracotta">
                  {fields.landmark}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="co-note" className={label}>
                Anything we should know?{" "}
                <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                id="co-note"
                name="note"
                rows={3}
                maxLength={1000}
                placeholder="Best time to deliver, floor, gate code…"
                aria-invalid={Boolean(fields.note)}
                className={`${field} resize-y`}
              />
              {fields.note && (
                <p role="alert" className="mt-1.5 text-xs text-terracotta">
                  {fields.note}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* --------------------------------------------------- how to pay */}
        <fieldset className="rounded-[2rem] bg-white p-7 shadow-soft sm:p-8">
          <legend className="text-display text-xl text-espresso">How would you like to pay?</legend>
          <label className="mt-6 flex cursor-pointer items-start gap-4 rounded-2xl border border-espresso/15 bg-cream/50 p-5">
            <input
              type="radio"
              name="payment_method"
              value="pay_on_delivery"
              defaultChecked
              className="mt-1 size-4 accent-[#9C4A2A]"
            />
            <span>
              <span className="block text-sm font-semibold text-espresso">
                Pay on delivery
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-espresso/50">
                We confirm the order and delivery date on WhatsApp, then you pay the
                driver in cash when the pieces arrive. No card details are taken on
                this site.
              </span>
            </span>
          </label>
        </fieldset>
      </div>

      {/* -------------------------------------------------------- summary */}
      <aside className="sticky top-28 rounded-[2rem] bg-espresso p-7 text-cream">
        <h2 className="text-eyebrow text-terracotta">Your order</h2>

        <ul className="mt-6 flex flex-col gap-3 text-sm">
          {(priced?.lines ?? []).map((line) => (
            <li key={`${line.product_id}:${line.variant_id ?? 0}`} className="flex gap-3">
              <span className="w-6 shrink-0 tabular-nums text-cream/45">{line.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{line.name}</span>
                {line.variant_name && (
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-cream/40">
                    {line.variant_name}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{money(line.line_total)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-cream/15 pt-5">
          <span className="text-sm font-semibold">Total</span>
          <span className="font-display text-2xl font-black tabular-nums">
            {money(priced?.subtotal)}
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl bg-terracotta/20 p-4 text-xs leading-relaxed">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-cream hover:text-espresso disabled:pointer-events-none disabled:opacity-55"
        >
          {submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Placing your order…" : "Place order"}
        </button>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-cream/45">
          By ordering you agree that {SITE.name} will contact you on the number above
          to confirm delivery.{" "}
          <Link href="/cart" className="underline underline-offset-4 hover:text-cream">
            Edit your cart
          </Link>
        </p>
      </aside>
    </form>
  );
}