"use client";

import type { Category } from "@/lib/types";
import CategoryCard from "./CategoryCard";
import { Reveal, RevealItem } from "./Reveal";

type CategoryGridProps = {
  categories: Category[];
};

/**
 * Bento grid of category blocks. First card is tall to break the visual rhythm;
 * collapses to a single column on mobile.
 */
export default function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <section className="bg-cream py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        <Reveal stagger={0.12}>
          <RevealItem>
            <p className="text-eyebrow text-terracotta">What we build</p>
          </RevealItem>

          <RevealItem>
            <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-3xl text-display text-espresso text-[clamp(2.5rem,6.5vw,5.5rem)]">
                Seating,
                <br />
                <span className="text-sage">milled from solid.</span>
              </h2>
              <p className="max-w-sm text-[15px] leading-relaxed text-espresso/55">
                Armchairs for the corner you always end up in. Chairs that earn their
                place at the table. Sofas built on a frame you can see, and repair.
              </p>
            </div>
          </RevealItem>
        </Reveal>

        {categories.length > 0 ? (
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-6">
            {categories.map((category, i) => (
              <CategoryCard
                key={category.id}
                category={category}
                index={i}
                size={i === 0 ? "tall" : "standard"}
              />
            ))}
          </div>
        ) : (
          <Reveal className="mt-14">
            <div className="rounded-[2.5rem] border border-dashed border-espresso/20 p-12 text-center">
              <p className="text-display text-2xl text-espresso/70">No categories yet</p>
              <p className="mt-3 text-sm text-espresso/50">
                Run <code className="rounded bg-espresso/5 px-2 py-1">db/seed.sql</code>{" "}
                against your database to populate the catalogue.
              </p>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
