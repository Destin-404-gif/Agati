"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import type { MediaAsset } from "@/lib/media-slots";
import MediaImage from "./MediaImage";
import PillButton from "./PillButton";
import ProductThumbStack from "./ProductThumbStack";
import { EASE } from "./Reveal";

/** One autoplay tick per slide, and one crossfade between them. */
const INTERVAL = 6000;
const FADE = 1.2;

type HeroProps = {
  featured: Product[];
  /** The `hero_slide_1..5` slots, in order. Entries may be `null` (empty slot). */
  slides: (MediaAsset | null)[];
};

export default function Hero({ featured, slides }: HeroProps) {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const slideCount = slides.length;
  const countRef = useRef(slideCount);
  useEffect(() => {
    countRef.current = slideCount;
  }, [slideCount]);

  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const paused = useRef(false);
  const startTimer = useRef<() => void>(() => {});

  // Gentle parallax: the photo field drifts slower than the copy over it.
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "6%"]);

  // Exactly one interval for the lifetime of the section. It is created once on
  // mount and cleared on unmount, so Strict Mode's double-invoke leaves a single
  // timer rather than two overlapping ones. `countRef` keeps the tick correct
  // without re-creating the interval when an admin adds or removes a slide.
  useEffect(() => {
    const tick = () => {
      if (paused.current) return;
      const total = countRef.current;
      if (total < 1) return;
      setIndex((i) => (i + 1) % total);
    };

    startTimer.current = () => {
      if (countRef.current < 2) return;
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(tick, INTERVAL);
    };

    startTimer.current();

    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, []);

  // Hold the slide while the pointer is over the hero or the tab is in the
  // background. The interval keeps running; the tick becomes a no-op.
  useEffect(() => {
    const onVisibility = () => {
      paused.current = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const goTo = useCallback((next: number) => {
    setIndex(next);
    startTimer.current();
  }, []);

  return (
    <section
      ref={section}
      className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-espresso"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {/* ---------------------------------------------------------- slides */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-[6%] inset-x-0 -z-10"
        style={reduced ? undefined : { y: imageY }}
      >
        {slides.map((asset, i) => (
          <motion.div
            key={`${asset?.url ?? "empty"}-${i}`}
            className="absolute inset-0"
            initial={false}
            animate={{ opacity: i === index ? 1 : 0 }}
            transition={{ duration: FADE, ease: "easeInOut" }}
          >
            <MediaImage
              asset={asset}
              fill
              sizes="100vw"
              quality={90}
              priority={i === 0}
              placeholderLabel="Hero banner"
              className="object-cover"
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Scrim: keeps the copy legible over any photo without tinting it green. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-espresso/90 via-espresso/60 to-espresso/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-espresso/80 via-espresso/40 to-transparent lg:w-3/4"
      />

      {/* ------------------------------------------------------------ copy */}
      {/* One column on mobile (copy, then the thumbnail strip), two from lg.
          `pt-8/lg:pt-12/xl:pt-16` guarantees 48-64px of air between the
          category nav and the headline; `items-center` vertically centres the
          thumbnails against the copy block. */}
      <div className="relative z-[1] mx-auto flex w-full max-w-site flex-1 flex-col px-gutter pb-8 pt-[var(--header-h)] sm:pb-10">
        <div className="flex flex-1 flex-col justify-center gap-14 pt-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:pt-12 xl:gap-20 xl:pt-16">
          <div className="max-w-xl">
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.08 }}
              className="text-cream"
            >
              <span className="block text-display text-[clamp(2.75rem,7vw,5.5rem)]">
                Wood that
              </span>
              <span className="block text-display text-[clamp(2.75rem,7vw,5.5rem)] text-terracotta">
                grows back.
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.18 }}
              className="mt-6 max-w-[500px] text-[15px] leading-relaxed text-cream/80 sm:mt-8 sm:text-base"
            >
              We mill our own oak, walnut and cherry, then cut every joint by hand.
              Solid timber, hardwax oil, and furniture that can be repaired instead
              of replaced.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.26 }}
              className="mt-8 flex flex-wrap items-center gap-5 sm:mt-10 sm:gap-6"
            >
              <PillButton href="/furniture" size="lg">
                Browse furniture
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path
                    d="M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </PillButton>
              <PillButton href="/services#timber" variant="outline" size="lg">
                Buy timber
              </PillButton>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
            className="shrink-0 self-center"
          >
            <ProductThumbStack products={featured.slice(0, 3)} />
          </motion.div>
        </div>

        {/* ------------------------------------------- wordmark + slide dots */}
        {/* Its own zone in normal flow rather than an absolutely-positioned
            overlay: `mt-16/lg:mt-20` holds 64-80px of clearance below
            whichever element sits lowest above it, so the wordmark can never
            overlap the CTAs or the thumbnails. */}
        <h1 className="pointer-events-none mt-16 shrink-0 select-none text-center text-display text-[clamp(3.5rem,11vw,8.5rem)] leading-none text-cream drop-shadow-[0_10px_40px_rgba(36,28,20,0.35)] lg:mt-20">
          Agati
        </h1>

        {slideCount > 1 && (
          <div className="mt-8 flex shrink-0 items-center justify-center gap-2.5 sm:mt-10">
            {slides.map((asset, i) => (
              <button
                key={`dot-${asset?.url ?? "empty"}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show slide ${i + 1} of ${slideCount}`}
                aria-current={i === index ? "true" : undefined}
                className={[
                  "h-2.5 rounded-full transition-all duration-300 ease-out",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream",
                  i === index ? "w-7 bg-cream" : "w-2.5 bg-cream/40 hover:bg-cream/70",
                ].join(" ")}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
