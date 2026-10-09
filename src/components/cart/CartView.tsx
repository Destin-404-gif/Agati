"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { money } from "@/lib/format";
import { SITE, whatsappLink } from "@/lib/siteConfig";
import { useCart } from "./CartProvider";

/** A line as the pricing endpoint returns it. */
export type PricedLine = {
  product_id: number;
  variant_id: number | null;
  slug: string;
  name: string;
  variant_name: string | null;
  image_url: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
};

type Priced = { lines: PricedLine[]; subtotal: string; count: number };

/**
 * The cart body.
 *
 * The local cart holds only ids and quantities, so the prices shown here are
 * always whatever /api/cart/price just returned. Any line the server rejects -
 * a deleted product, a piece that became made-to-measure, a quantity now above
 * stock - is reported as an error rather than silently dropped, so the customer
 * is never shown a total that the server would not accept.
 */
export default function CartView() {
  const { items, ready, setQuantity, remove, clear } = useCart();

  // The result is tagged with the cart it was priced from, so a stale response
  // can never be shown next to lines it was not priced for, and "still loading"
  // is derived rather than set from inside the effect.
  const requestKey = JSON.stringify(items);
  const [result, setResult] = useState<{ key: string; priced: Priced | null; error: string | null }>(
    { key: "", priced: null, error: null },
  );

  const current = result.key === requestKey ? result : { key: requestKey, priced: null, error: null };
  const priced = current.priced;
  const error = current.error;
  const loading = ready && items.length > 0 && !priced && !error;

  useEffect(() => {
    // An empty cart has nothing to price - and never gets a fetch.
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
        return data as Priced;
      })
      .then((data) => {
        if (ignore) return;
        setResult({ key: requestKey, priced: data, error: null });
      })
      .catch((err: Error) => {
        if (ignore) return;
        setResult({ key: requestKey, priced: null, error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [items, ready, requestKey]);

  if (!ready || (loading && !priced)) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-espresso/50">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading your cart…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <ShoppingBag className="mx-auto size-10 text-espresso/25" aria-hidden="true" />
        <h2 className="mt-6 font-display text-2xl font-black text-espresso">Your cart is empty</h2>
        <p className="mt-3 text-sm leading-relaxed text-espresso/55">
          Nothing in here yet. Have a look through the catalogue, or tell us about a
          made-to-measure piece and we will price it for you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/furniture"
            className="inline-flex items-center rounded-full bg-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta"
          >
            Browse the catalogue
          </Link>
          <a
            href={whatsappLink("Hello, I would like to ask about a made-to-measure piece.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:border-terracotta hover:text-terracotta"
          >
            Ask on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 pb-20 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div>
        <ul className="flex flex-col gap-4">
          {(priced?.lines ?? []).map((line) => {
            const id = line.variant_id ? `${line.product_id}:${line.variant_id}` : `${line.product_id}:0`;
            return (
              <li
                key={id}
                className="flex gap-4 rounded-[1.5rem] bg-white p-4 shadow-soft"
              >
                <Link
                  href={`/furniture/${line.slug}`}
                  className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-cream"
                >
                  {line.image_url ? (
                    <Image
                      src={line.image_url}
                      alt={line.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="size-full bg-sage/15" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/furniture/${line.slug}`}
                        className="truncate text-[15px] font-semibold text-espresso hover:text-terracotta"
                      >
                        {line.name}
                      </Link>
                      {line.variant_name && (
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-espresso/40">
                          {line.variant_name}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-[15px] font-semibold tabular-nums text-espresso">
                      {money(line.line_total)}
                    </p>
                  </div>

                  <p className="text-xs text-espresso/45">
                    {money(line.unit_price)} each
                  </p>

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-full bg-espresso/5 p-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(id, line.quantity - 1)}
                        aria-label={`Decrease quantity of ${line.name}`}
                        className="flex size-8 items-center justify-center rounded-full text-espresso transition-colors hover:bg-white"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums text-espresso">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(id, line.quantity + 1)}
                        aria-label={`Increase quantity of ${line.name}`}
                        className="flex size-8 items-center justify-center rounded-full text-espresso transition-colors hover:bg-white"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(id)}
                      aria-label={`Remove ${line.name} from your cart`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/40 transition-colors hover:text-terracotta"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={clear}
          className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/40 underline-offset-4 transition-colors hover:text-terracotta hover:underline"
        >
          Empty the cart
        </button>
      </div>

      {/* ------------------------------------------------------- summary */}
      <aside className="sticky top-28 rounded-[2rem] bg-espresso p-7 text-cream">
        <h2 className="text-eyebrow text-terracotta">Summary</h2>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-cream/50">
              Items ({priced?.count ?? 0})
            </dt>
            <dd className="tabular-nums">{money(priced?.subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-cream/50">Delivery</dt>
            <dd className="text-cream/70">Arranged on confirmation</dd>
          </div>
        </dl>
        <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-cream/15 pt-5">
          <span className="text-sm font-semibold">Total</span>
          <span className="font-display text-2xl font-black tabular-nums">
            {money(priced?.subtotal)}
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl bg-terracotta/20 p-4 text-xs leading-relaxed text-cream">
            {error}
          </p>
        )}

        <Link
          href={error ? "/furniture" : "/checkout"}
          aria-disabled={Boolean(error)}
          className={[
            "mt-6 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
            error
              ? "pointer-events-none bg-cream/15 text-cream/40"
              : "bg-terracotta text-cream hover:bg-cream hover:text-espresso",
          ].join(" ")}
        >
          {error ? "Cart needs attention" : "Continue to checkout"}
        </Link>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-cream/45">
          No card needed. {SITE.shortName} confirms the order and delivery date on
          WhatsApp, and you pay on delivery.
        </p>
      </aside>
    </div>
  );
}