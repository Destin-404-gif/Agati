"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, ShoppingBag } from "lucide-react";
import { useCart, type AddableProduct } from "./CartProvider";

type Props = {
  product: AddableProduct & { is_custom?: boolean; stock_quantity?: number };
  /** Quantity to add. The product card always adds one. */
  quantity?: number;
  variant?: { id: number; name: string | null } | null;
  className?: string;
  /** Where a made-to-measure piece sends the customer instead. */
  quoteHref?: string;
  label?: string;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55";

/**
 * The Add to Cart control. Made-to-measure pieces never reach this: they render
 * a "Request a Quote" link to the existing quote form instead, because their
 * price is agreed per commission.
 *
 * The click is synchronous and the cart is local, so there is no pending state
 * to get stuck - but a short guard stops a double-tap from adding twice.
 */
export default function AddToCartButton({
  product,
  quantity = 1,
  variant = null,
  className = "",
  quoteHref = "/contact#quote",
  label = "Add to Cart",
}: Props) {
  const { add } = useCart();
  const [locked, setLocked] = useState(false);

  if (product.is_custom) {
    return (
      <Link
        href={`${quoteHref}?product=${product.slug}`}
        className={[base, "bg-espresso text-cream hover:bg-terracotta", className].join(" ")}
      >
        Request a Quote
      </Link>
    );
  }

  if (typeof product.stock_quantity === "number" && product.stock_quantity < 1) {
    return (
      <span className={[base, "cursor-not-allowed bg-espresso/10 text-espresso/50", className].join(" ")}>
        Sold out
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${label}: ${product.name}`}
      disabled={locked}
      onClick={() => {
        if (locked) return;
        setLocked(true);
        add(product, quantity, variant);
        window.setTimeout(() => setLocked(false), 350);
      }}
      className={[base, "bg-espresso text-cream hover:bg-terracotta", className].join(" ")}
    >
      {locked ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <ShoppingBag className="size-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}