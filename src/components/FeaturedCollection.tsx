"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { TIMBERS } from "@/lib/data";
import { money } from "@/lib/format";
import type { MediaAsset } from "@/lib/media-slots";
import type { Product } from "@/lib/types";
import MediaImage from "./MediaImage";
import { Reveal, RevealItem } from "./Reveal";
import PillButton from "./PillButton";

type FeaturedCollectionProps = {
  products: Product[];
  image: MediaAsset | null;
};

type RackBadge = { label: string; className: string };

/**
 * One pill per card, top-left inside the image. Precedence:
 * made-to-measure > new > low stock, so badges never collide.
 */
function rackBadgeFor(product: Product): RackBadge | null {
  if (product.is_custom) return { label: "Made to order", className: "bg-sage" };
  if (product.is_new) return { label: "New", className: "bg-espresso" };
  if (product.stock_quantity > 0 && product.stock_quantity <= 5) {
    return { label: `${product.stock_quantity} left`, className: "bg-terracotta" };
  }
  return null;
}

/**
 * A single rack tile. `product` is optional: when the array runs short the cell
 * renders as a quiet "in the workshop" placeholder so the 2x2 grid never has a
 * hole and the column keeps its height opposite the lifestyle photo.
 */
function RackCard({ product }: { product: Product | null }) {
  const badge = product ? rackBadgeFor(product) : null;
  const name = product?.name?.trim() || "Untitled piece";
  const category = product?.category_name?.trim() || "Uncategorised";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-soft transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-sage/15">
        {product?.image_url ? (
          <Image
            src={product.image_url}
            alt={name}
            fill
            sizes="(max-width: 599px) 90vw, (max-width: 1024px) 45vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : product ? (
          <div className="flex size-full items-center justify-center bg-sage/15 text-espresso/35">
            <span className="font-display text-4xl font-black">{name.slice(0, 1)}</span>
          </div>
        ) : (
          <div className="flex size-full items-center justify-center bg-sage/15 text-espresso/35">
            <span className="px-4 text-center text-[10px] font-semibold uppercase tracking-[0.18em]">
              In the workshop
            </span>
          </div>
        )}

        {badge && (
          <span
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cream shadow-soft ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 min-h-[2.75em] text-[15px] leading-snug font-semibold text-espresso">
          {product ? name : "New pieces landing here each month"}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-espresso/45">
            {product ? category : "Workshop"}
          </p>
          <p className="shrink-0 text-[15px] font-bold tabular-nums text-espresso">
            {product ? money(product.price) : ""}
          </p>
        </div>
      </div>
    </article>
  );
}

/** Dark espresso bento: lifestyle photo left, rack cards + timber CTA right. */
export default function FeaturedCollection({
  products,
  image,
}: FeaturedCollectionProps) {
  const reduced = useReducedMotion();
  const picks = products.slice(0, 4);
  const slots = Array.from({ length: 4 }, (_, i) => picks[i] ?? null);

  return (
    <section className="bg-espresso py-20 text-cream sm:py-28 lg:py-32">
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        <Reveal stagger={0.12}>
          <RevealItem>
            <p className="text-eyebrow text-terracotta">Featured commission</p>
          </RevealItem>
          <RevealItem>
            <h2 className="mt-6 max-w-4xl text-display text-cream text-[clamp(2.5rem,6.5vw,5.5rem)]">
              Ashfield
              <span className="text-terracotta"> - </span>
              a full-wall library in white oak
            </h2>
          </RevealItem>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-[1.2fr_1fr] lg:items-stretch">
          {/* ------------------------------------------- lifestyle photo card */}
          <Reveal className="h-full">
            <RevealItem fade className="h-full">
              <motion.figure
                whileHover={reduced ? undefined : { scale: 1.015, y: -4 }}
                transition={{ type: "spring", stiffness: 240, damping: 26 }}
                className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] bg-espresso-soft shadow-lift lg:h-full"
              >
                <MediaImage
                  asset={image}
                  alt="A full-wall oak library with a reading chair in a panelled room"
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  placeholderLabel="Featured commission"
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-espresso/90 via-espresso/25 to-transparent"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <p className="text-eyebrow mb-4 text-cream/60">
                    1930s manor &nbsp;·&nbsp; templated off the wall
                  </p>
                  <p className="max-w-md text-[15px] leading-relaxed text-cream/80">
                    We templated every shelf upright from the plaster itself and
                    scribed the carcase in on the day, so the joinery disappears
                    into the room instead of sitting proud of it.
                  </p>
                  <div className="mt-7">
                    <PillButton href="/projects" variant="cream" size="md">
                      See the project
                    </PillButton>
                  </div>
                </figcaption>
              </motion.figure>
            </RevealItem>
          </Reveal>

          {/* -------------------------------------- racks now + timber stock */}
          <div className="flex h-full flex-col gap-6 lg:gap-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow text-terracotta">In the racks now</p>
                <p className="mt-2 text-sm text-cream/55">
                  {picks.length > 0
                    ? `${picks.length} pieces ready to go out the door`
                    : "Fresh stock drying to 8-12%"}
                </p>
              </div>
              <Link
                href="/furniture"
                className="group inline-flex shrink-0 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-cream/70 transition-colors hover:text-cream"
              >
                View all
                <svg
                  viewBox="0 0 24 24"
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>

            <Reveal
              stagger={0.1}
              className="grid flex-1 auto-rows-fr grid-cols-1 gap-4 min-[600px]:grid-cols-2 lg:gap-5"
            >
              {slots.map((product, i) => (
                <RevealItem key={product?.id ?? `rack-slot-${i}`} className="h-full">
                  <RackCard product={product} />
                </RevealItem>
              ))}
            </Reveal>

            <RevealItem fade>
              <div className="rounded-[1.5rem] bg-sage p-6 sm:p-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-eyebrow text-cream/60">Timber stock</p>
                    <h3 className="mt-2 max-w-sm text-[18px] leading-snug font-semibold text-cream">
                      Hardwood boards, kiln dried to 8-12%.
                    </h3>
                  </div>
                  <PillButton href="/services#timber" variant="cream" size="sm">
                    Timber supply
                  </PillButton>
                </div>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {TIMBERS.map((t) => (
                    <li
                      key={t.name}
                      className="rounded-full bg-cream/15 px-4 py-2 text-[11px] font-medium tracking-wide text-cream"
                    >
                      {t.name}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealItem>
          </div>
        </div>
      </div>
    </section>
  );
}