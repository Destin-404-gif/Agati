"use client";

import Image from "next/image";
import { useState } from "react";
import { money } from "@/lib/format";
import type { ProductDetail } from "@/lib/types";
import AddToCartButton from "@/components/cart/AddToCartButton";

/**
 * The interactive half of the product page: which image is showing, which
 * variant is chosen, how many, and the add-to-cart control.
 *
 * Only the options are held here - the prices come from the same props the server
 * rendered, and the cart re-prices itself anyway, so nothing here can invent a
 * figure.
 */
export default function ProductDetailClient({ product }: { product: ProductDetail }) {
  const images = product.images.length
    ? product.images.map((i) => i.image_url)
    : product.image_url
      ? [product.image_url]
      : [];

  const [active, setActive] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const unit = Math.max(0, Number(product.price) + Number(variant?.price_modifier ?? 0));
  const main = images[active] ?? null;
  const soldOut = product.stock_quantity < 1;

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
      {/* ---------------------------------------------------------- gallery */}
      <div className="flex flex-col gap-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-cream">
          {main ? (
            <Image
              src={main}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 92vw, 46vw"
              className="object-cover"
            />
          ) : (
            <div className="size-full bg-sage/15" />
          )}

          {product.is_new && (
            <span className="absolute left-4 top-4 rounded-full bg-espresso px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
              New
            </span>
          )}
          {product.is_custom && (
            <span className="absolute left-4 top-4 rounded-full bg-espresso px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
              Made to order
            </span>
          )}
          {!soldOut && !product.is_custom && product.stock_quantity <= 5 && (
            <span className="absolute right-4 top-4 rounded-full bg-terracotta px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
              {product.stock_quantity} left
            </span>
          )}
        </div>

        {images.length > 1 && (
          <ul className="flex flex-wrap gap-3">
            {images.map((src, i) => (
              <li key={src + i}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`View image ${i + 1} of ${images.length}`}
                  aria-current={i === active}
                  className={[
                    "relative size-20 overflow-hidden rounded-xl bg-cream transition-all duration-300",
                    i === active ? "ring-2 ring-terracotta" : "opacity-70 hover:opacity-100",
                  ].join(" ")}
                >
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------------------------------------------------- details */}
      <div>
        {product.category_slug && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-terracotta">
            {product.category_name}
          </p>
        )}
        <h1 className="mt-3 font-display text-3xl font-black tracking-[-0.03em] text-espresso sm:text-4xl">
          {product.name}
        </h1>
        {product.sku && (
          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-espresso/35">
            SKU {product.sku}
          </p>
        )}

        <p className="mt-6 font-display text-2xl font-black tabular-nums text-espresso">
          {money(unit)}
        </p>
        <p className="mt-1 text-xs text-espresso/45">
          {product.is_custom
            ? "Priced per commission - tell us your room and we will quote a fixed price."
            : "Includes VAT. Delivery is arranged with you on confirmation."}
        </p>

        {product.description && (
          <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-espresso/65">
            {product.description}
          </p>
        )}

        {/* ------------------------------------------------------- variants */}
        {product.variants.length > 0 && (
          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/50">
              Finish
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id === variantId ? null : v.id)}
                  aria-pressed={v.id === variantId}
                  className={[
                    "rounded-full border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                    v.id === variantId
                      ? "border-espresso bg-espresso text-cream"
                      : "border-espresso/15 text-espresso/65 hover:border-espresso/40",
                  ].join(" ")}
                >
                  {v.variant_name ?? v.color ?? "Option"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------- quantity */}
        {!product.is_custom && !soldOut && (
          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/50">
              Quantity
            </p>
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-soft">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="size-10 rounded-full text-lg leading-none text-espresso transition-colors hover:bg-cream"
              >
                &minus;
              </button>
              <span className="w-12 text-center text-sm font-semibold tabular-nums text-espresso">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
                aria-label="Increase quantity"
                disabled={quantity >= product.stock_quantity}
                className="size-10 rounded-full text-lg leading-none text-espresso transition-colors hover:bg-cream disabled:opacity-30"
              >
                +
              </button>
            </div>
            {quantity >= product.stock_quantity && (
              <p className="mt-2 text-xs text-espresso/45">
                That is all we have in the workshop right now.
              </p>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------- buy */}
        <div className="mt-9 flex flex-wrap gap-3">
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              image_url: product.image_url,
              is_custom: product.is_custom,
              stock_quantity: product.stock_quantity,
            }}
            quantity={quantity}
            variant={variant ? { id: variant.id, name: variant.variant_name } : null}
            quoteHref="/contact#quote"
            className="min-w-52"
            label={product.is_custom ? "Request a Quote" : "Add to Cart"}
          />
        </div>

        {!product.is_custom && (
          <dl className="mt-10 space-y-3 border-t border-espresso/10 pt-6 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-espresso/40">Availability</dt>
              <dd className="text-espresso/70">
                {soldOut
                  ? "Out of stock - ask us about a new lead time"
                  : `In stock (${product.stock_quantity})`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-espresso/40">Delivery</dt>
              <dd className="text-espresso/70">Musanze &amp; northern districts</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-espresso/40">Payment</dt>
              <dd className="text-espresso/70">Pay on delivery</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}