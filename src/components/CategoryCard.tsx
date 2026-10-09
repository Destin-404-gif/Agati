"use client";

import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { createElement } from "react";
import type { Category } from "@/lib/types";
import { dbCategoryIcon } from "@/lib/navigation";
import { EASE } from "./Reveal";

type CategoryCardProps = {
  category: Category;
  /** Bento blocks vary in height to break the rhythm. */
  size?: "tall" | "standard";
  index?: number;
};

/** Rounded bento block: image zooms on hover, label and pill CTA beneath. */
export default function CategoryCard({
  category,
  size = "standard",
  index = 0,
}: CategoryCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.75, ease: EASE, delay: index * 0.12 }}
      className="group flex h-full flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-soft transition-shadow duration-500 hover:shadow-lift"
    >
      <div
        className={[
          "relative w-full overflow-hidden",
          size === "tall" ? "aspect-[3/4]" : "aspect-[4/5]",
        ].join(" ")}
      >
        {category.image_url ? (
          <Image
            src={category.image_url}
            alt={`${category.name} collection`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
          />
        ) : (
          <div className="size-full bg-sage/20" />
        )}

        {typeof category.product_count === "number" && (
          <span className="absolute right-4 top-4 rounded-full bg-cream/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-espresso backdrop-blur-sm">
            {category.product_count} pieces
          </span>
        )}

        {dbCategoryIcon(category.slug) && (
          <span className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-full bg-espresso/80 text-cream backdrop-blur-sm">
            {createElement(dbCategoryIcon(category.slug)!, {
              className: "size-4",
              "aria-hidden": true,
            })}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-5 p-7 sm:p-8">
        <div>
          <h3 className="text-display text-[clamp(1.75rem,3vw,2.5rem)] text-espresso">
            {category.name}
          </h3>
          {size === "tall" && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-espresso/55">
              Shaped by hand, finished with hardwax oil, and built to be moved
              rather than replaced.
            </p>
          )}        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/category/${category.slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-espresso px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-all duration-300 hover:scale-105 hover:bg-terracotta active:scale-[0.97]"
          >
            Shop
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
          <span className="text-[11px] uppercase tracking-[0.16em] text-espresso/35">
            {category.slug}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
