"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TIMBERS } from "@/lib/data";
import type { MediaAsset } from "@/lib/media-slots";
import type { Product } from "@/lib/types";
import MediaImage from "./MediaImage";
import { Reveal, RevealItem } from "./Reveal";
import ProductCard from "./ProductCard";
import PillButton from "./PillButton";

type FeaturedCollectionProps = {
  products: Product[];
  image: MediaAsset | null;
};

/** Dark espresso bento: large lifestyle photo left, copy + product tiles right. */
export default function FeaturedCollection({
  products,
  image,
}: FeaturedCollectionProps) {
  const reduced = useReducedMotion();
  const picks = products.slice(0, 3);

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

        <div className="mt-14 grid gap-5 lg:mt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
          {/* ------------------------------------------------ lifestyle photo */}
          <Reveal stagger={0.14} className="h-full">
            <RevealItem fade>
              <motion.figure
                whileHover={reduced ? undefined : { scale: 1.015, y: -4 }}
                transition={{ type: "spring", stiffness: 240, damping: 26 }}
                className="relative h-full min-h-[24rem] overflow-hidden rounded-[2.5rem] bg-espresso-soft shadow-lift lg:min-h-[42rem]"
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
                  className="absolute inset-0 bg-gradient-to-t from-espresso/85 via-espresso/20 to-transparent"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
                  <p className="text-eyebrow mb-4 text-cream/55">
                    1930s manor &nbsp;·&nbsp; templated off the wall
                  </p>
                  <p className="max-w-md text-[15px] leading-relaxed text-cream/75">
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

          {/* ------------------------------------------------------- tiles */}
          <div className="flex flex-col gap-5 lg:gap-6">
            <Reveal stagger={0.13} delay={0.12} className="flex-1">
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {picks.map((product, i) => (
                  <RevealItem key={product.id}>
                    <ProductCard product={product} index={i} tone="white" />
                  </RevealItem>
                ))}
              </div>
            </Reveal>

            {/* Timber stock block closes the bento composition. */}
            <RevealItem fade>
              <div id="timber" className="scroll-mt-28 rounded-[2.5rem] bg-sage p-7 sm:p-8">
                <p className="text-eyebrow text-cream/60">In the racks now</p>
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
                <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
                  <p className="text-sm text-cream/70">Kiln dried to 8-12%</p>
                  <PillButton href="/services#timber" variant="cream" size="md">
                    Timber supply
                  </PillButton>
                </div>
              </div>
            </RevealItem>
          </div>
        </div>
      </div>
    </section>
  );
}
