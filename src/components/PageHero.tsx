"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { MediaAsset } from "@/lib/media-slots";
import { EASE } from "./Reveal";
import CategoryIllustration from "./CategoryIllustration";
import MediaImage from "./MediaImage";

type Crumb = { label: string; href?: string };

type PageHeroProps = {
  eyebrow: string;
  /** Oversized display line. Use \n for a forced break. */
  title: string;
  accent?: string;
  intro: string;
  /**
   * The page's `page_hero_*` slot, for pages that have a real photograph. Null
   * renders the neutral placeholder. Ignored when `illustrationSlug` is set.
   */
  image?: MediaAsset | null;
  /**
   * Draw the hero artwork in code from this slug instead of using `image`.
   * Category, sub-category and navigation pages use this rather than an upload.
   */
  illustrationSlug?: string | null;
  /** The parent category slug, when `illustrationSlug` is a sub-category. */
  illustrationParentSlug?: string | null;
  crumbs?: Crumb[];
};

/** Inner-page masthead. Matches the homepage hero's scale, but light. */
export default function PageHero({
  eyebrow,
  title,
  accent,
  intro,
  image,
  illustrationSlug,
  illustrationParentSlug,
  crumbs = [],
}: PageHeroProps) {
  const reduced = useReducedMotion();
  const [first, second] = title.split("\n");
  const drawn = Boolean(illustrationSlug || illustrationParentSlug);

  return (
    <section className="relative overflow-hidden bg-sage pt-[var(--header-h)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-sage-light/25 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1600px] px-5 sm:px-8">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-cream/50">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {c.href ? (
                    <Link href={c.href} className="transition-colors hover:text-cream">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-cream/85">{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="grid items-end gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="pb-4">
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="text-eyebrow text-terracotta"
            >
              {eyebrow}
            </motion.p>

            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.08 }}
              className="mt-6 text-display text-cream text-[clamp(3rem,8.5vw,7rem)]"
            >
              {first}
              {second && (
                <>
                  <br />
                  <span className="text-terracotta">{second}</span>
                </>
              )}
              {accent && <span className="text-terracotta"> {accent}</span>}
            </motion.h1>

            <motion.p
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.18 }}
              className="mt-7 max-w-lg text-[15px] leading-relaxed text-cream/80"
            >
              {intro}
            </motion.p>
          </div>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 34, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.14 }}
            whileHover={reduced ? undefined : { scale: 1.02, y: -4 }}
            className="relative aspect-[5/4] w-full overflow-hidden rounded-[2.5rem] bg-cream-dark shadow-lift sm:aspect-[16/10]"
          >
            {drawn ? (
              <CategoryIllustration
                slug={illustrationSlug}
                parentSlug={illustrationParentSlug}
                className="h-full w-full p-6 sm:p-9"
              />
            ) : (
              <MediaImage asset={image ?? null} placeholderLabel={eyebrow} fill sizes="(max-width: 1024px) 100vw, 40vw" priority />
            )}
          </motion.div>
        </div>
      </div>

      <div className="mt-16 h-16 sm:mt-20 sm:h-24" aria-hidden="true" />
    </section>
  );
}
