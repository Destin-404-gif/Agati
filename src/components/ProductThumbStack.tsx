"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { EASE } from "./Reveal";

/**
 * Three circular variant thumbnails stacked down the right edge of the hero.
 * Each lifts on hover with a spring transition.
 */
export default function ProductThumbStack({ products }: { products: Product[] }) {
  const reduced = useReducedMotion();

  if (products.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-5 lg:items-end">
      <ul className="flex flex-row gap-5 overflow-x-auto no-scrollbar sm:gap-6 lg:flex-col">
        {products.map((product, i) => (
          <motion.li
            key={product.id}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.45 + i * 0.1 }}
            whileHover={reduced ? undefined : { scale: 1.05, y: -4 }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            className="group shrink-0"
          >
            <Link
              href={`/furniture?q=${encodeURIComponent(product.name)}`}
              className="relative block size-24 overflow-hidden rounded-full bg-cream shadow-soft ring-1 ring-cream/25 transition-shadow duration-300 group-hover:shadow-lift sm:size-28"
              title={`${product.name} - ${money(product.price)}`}
            >
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  sizes="112px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-cream/50">
                  {product.name.slice(0, 1)}
                </span>
              )}
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
