"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";
import AddToCartButton from "./cart/AddToCartButton";
import { EASE } from "./Reveal";

type ProductCardProps = {
  product: Product;
  index?: number;
  /** White rounded block for the dark featured section. */
  tone?: "light" | "white";
};

/** Bento product tile: zoom-on-hover image, price, and a slide-up quote CTA. */
export default function ProductCard({ product, index = 0, tone = "light" }: ProductCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: EASE, delay: index * 0.1 }}
      whileHover={reduced ? undefined : { y: -4 }}
      className={[
        "group relative flex flex-col overflow-hidden rounded-[2rem] p-3 shadow-soft transition-shadow duration-500 hover:shadow-lift",
        tone === "white" ? "bg-white" : "bg-white/70 backdrop-blur-sm",
      ].join(" ")}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] bg-cream">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
          />
        ) : (
          <div className="size-full bg-sage/15" />
        )}

        {product.is_custom && (
          <span className="absolute left-3 top-3 rounded-full bg-espresso px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
            Made to order
          </span>
        )}
        {!product.is_custom && product.is_new && (
          <span className="absolute left-3 top-3 rounded-full bg-espresso px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
            New
          </span>
        )}
        {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
          <span className="absolute right-3 top-3 rounded-full bg-terracotta px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
            {product.stock_quantity} left
          </span>
        )}

        {/* The action slides up from the bottom edge on hover. It is the cart
            button for catalogue pieces and a quote link for made-to-measure
            ones, so it is always a real control rather than a dead "Get Quote". */}
        <div className="absolute inset-x-3 bottom-3 translate-y-[130%] transition-transform duration-500 ease-out group-hover:translate-y-0 focus-within:translate-y-0">
          <AddToCartButton
            product={product}
            quoteHref="/contact#quote"
            className="w-full"
            label={product.is_custom ? "Request a Quote" : "Add to Cart"}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 px-3 pb-2 pt-5">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-espresso">{product.name}</h3>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-espresso/40">
            {product.category_name ?? "Uncategorised"}
          </p>
        </div>
        <p className="shrink-0 text-[15px] font-semibold tabular-nums text-espresso">
          {money(product.price)}
        </p>
      </div>
    </motion.article>
  );
}
