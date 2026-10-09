"use client";

import { motion, useReducedMotion } from "framer-motion";
import { STATS, VALUES } from "@/lib/data";
import type { MediaAsset } from "@/lib/media-slots";
import MediaImage from "./MediaImage";
import { Reveal, RevealItem } from "./Reveal";
import PillButton from "./PillButton";

/** Two-column editorial split: oversized statement left, workshop teaser right. */
export default function IntroSection({ image }: { image: MediaAsset | null }) {
  const reduced = useReducedMotion();

  return (
    <section className="bg-cream py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          {/* ------------------------------------------------------- copy */}
          <div>
            <Reveal stagger={0.12}>
              <RevealItem>
                <p className="text-eyebrow text-terracotta">The workshop</p>
              </RevealItem>

              <RevealItem>
                <h2 className="mt-6 text-display text-espresso text-[clamp(2.5rem,6vw,5rem)]">
                  One tree,
                  <br />
                  <span className="text-sage">one piece.</span>
                </h2>
              </RevealItem>

              <RevealItem>
                <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-espresso/65 sm:text-base">
                  We buy standing and fallen timber from managed woodland within
                  300km, air-dry it on our own racks, and cut every joint by hand.
                  Nothing is moulded twice, nothing is glued shut, and every board
                  is traceable to the tree it came from.
                </p>
              </RevealItem>

              <RevealItem>
                <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-espresso/10 pt-8 sm:grid-cols-4">
                  {STATS.map((stat) => (
                    <div key={stat.v}>
                      <dt className="text-display text-[clamp(1.5rem,3.5vw,2.5rem)] text-espresso">
                        {stat.k}
                      </dt>
                      <dd className="mt-1 text-[11px] uppercase leading-snug tracking-[0.14em] text-espresso/40">
                        {stat.v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </RevealItem>

              <RevealItem>
                <div className="mt-10">
                  <PillButton href="/about" size="lg">
                    How we work
                  </PillButton>
                </div>
              </RevealItem>
            </Reveal>
          </div>

          {/* ------------------------------------------------------ teaser */}
          <Reveal stagger={0.16} delay={0.1}>
            <RevealItem fade>
              <motion.div
                whileHover={reduced ? undefined : { scale: 1.02, y: -4 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="relative aspect-[4/5] w-full overflow-hidden rounded-[2.5rem] bg-espresso shadow-lift"
              >
                <MediaImage
                  asset={image}
                  alt="A maker cutting a length of oak on the workshop saw floor"
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  placeholderLabel="Workshop photo"
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-espresso/75 via-espresso/10 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-8">
                  <p className="text-eyebrow text-cream/60">Since 2015</p>
                  <p className="mt-3 font-display text-[clamp(1.5rem,3vw,2.25rem)] font-black leading-tight text-cream">
                    Eleven makers,
                    <br />
                    one sawmill.
                  </p>
                </div>
              </motion.div>
            </RevealItem>
          </Reveal>
        </div>

        {/* -------------------------------------------------- values strip */}
        <Reveal stagger={0.1} delay={0.15} className="mt-20 lg:mt-28">
          <p className="text-eyebrow text-terracotta">Why it lasts</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {VALUES.map((value) => (
              <RevealItem key={value.title}>
                <div className="h-full rounded-[2rem] bg-white p-7 shadow-soft">
                  <h3 className="text-display text-[1.35rem] text-espresso">{value.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-espresso/60">{value.body}</p>
                </div>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
