import type { Metadata } from "next";
import Link from "next/link";
import MediaImage from "@/components/MediaImage";
import PageHero from "@/components/PageHero";
import PillButton from "@/components/PillButton";
import { Reveal, RevealItem } from "@/components/Reveal";
import { PROCESS, TIMBERS } from "@/lib/data";
import { getMedia, pageHeroSlot } from "@/lib/media";

export const metadata: Metadata = {
  title: "Custom Furniture",
  description:
    "One-off furniture built to your room. Drawings before we cut, a fixed price, and solid hardwood throughout. Tell us what you need.",
};

export const dynamic = "force-dynamic";

const HERO_KEY = pageHeroSlot("custom-furniture");
const RACKS_KEY = "custom_furniture_timber_racks";

const BUDGETS = [
  { range: "Under $2,000", note: "A single chair, stool, side table or small bench." },
  { range: "$2,000 - $8,000", note: "Dining tables, beds, wardrobes, wall units." },
  { range: "$8,000 - $25,000", note: "Libraries, kitchens, staircases, complete rooms." },
  { range: "$25,000 +", note: "Restoration of listed interiors and full fit-outs." },
];

export default async function CustomFurniturePage() {
  const media = await getMedia([HERO_KEY, RACKS_KEY]);

  return (
    <main>
      <PageHero
        eyebrow="Custom furniture"
        title={"Your room,\ncut to size"}
        intro="Commission a piece built around the light, the floor and the awkward corner you have never quite got right. Drawings first, a fixed price, and nothing cut until you sign it off."
        image={media[HERO_KEY] ?? null}
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Custom Furniture" },
        ]}
      />

      {/* ------------------------------------------------ what you can ask for */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.1}>
            <RevealItem>
              <p className="text-eyebrow text-terracotta">Commission anything</p>
            </RevealItem>
            <RevealItem>
              <h2 className="mt-6 max-w-3xl text-display text-espresso text-[clamp(2.25rem,5vw,4rem)]">
                If it can be cut from timber, we can build it.
              </h2>
            </RevealItem>
          </Reveal>

          <Reveal stagger={0.1} delay={0.15} className="mt-14">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {[
                { t: "Dining tables", b: "Single slabs with bookmatched edges, or matched boards with breadboard ends." },
                { t: "Beds & headboards", b: "Wall-to-wall frames, knock-down so a house move is a two-person job." },
                { t: "Storage", b: "Wardrobes, libraries and shelving scribed to walls that are not straight." },
                { t: "Seating", b: "Anything with a curve in it - bent backs, sculpted arms, saddle seats." },
                { t: "Kitchens", b: "Worktops, cabinets and islands in hardwood that survives hot pans." },
                { t: "Restoration", b: "Re-cut tenons, re-caned seats, stripped varnish, back to hardwax oil." },
              ].map((item) => (
                <RevealItem key={item.t}>
                  <div className="h-full rounded-[2rem] bg-white p-7 shadow-soft">
                    <h3 className="text-display text-[1.4rem] text-espresso">{item.t}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-espresso/60">{item.b}</p>
                  </div>
                </RevealItem>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- process */}
      <section id="process" className="scroll-mt-28 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.1}>
            <RevealItem>
              <p className="text-eyebrow text-terracotta">How a commission runs</p>
            </RevealItem>
            <RevealItem>
              <h2 className="mt-6 max-w-3xl text-display text-espresso text-[clamp(2.25rem,5vw,4rem)]">
                Six steps. No board is cut until step three.
              </h2>
            </RevealItem>
          </Reveal>

          <Reveal stagger={0.09} delay={0.15} className="mt-14">
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {PROCESS.map((step) => (
                <RevealItem key={step.step}>
                  <li className="h-full rounded-[2rem] bg-cream p-7">
                    <span className="text-display text-3xl text-sage">{step.step}</span>
                    <h3 className="mt-4 font-display text-xl font-black text-espresso">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-espresso/60">{step.body}</p>
                  </li>
                </RevealItem>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- timbers */}
      <section className="bg-espresso py-20 text-cream sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
            <Reveal stagger={0.1} className="flex flex-col justify-center">
              <RevealItem>
                <p className="text-eyebrow text-terracotta">Choose your timber</p>
              </RevealItem>
              <RevealItem>
                <h2 className="mt-6 text-display text-cream text-[clamp(2.25rem,5vw,4rem)]">
                  Fourteen species in the racks.
                </h2>
              </RevealItem>
              <RevealItem>
                <div className="relative mt-9 aspect-[4/3] w-full overflow-hidden rounded-[2.5rem] bg-espresso-soft">
                  <MediaImage
                    asset={media[RACKS_KEY] ?? null}
                    alt="Dried hardwood stacked on air-drying racks"
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    placeholderLabel="Air-drying racks"
                    className="object-cover"
                  />
                </div>
              </RevealItem>
            </Reveal>

            <Reveal stagger={0.08} delay={0.12}>
              <div className="space-y-3">
                {TIMBERS.map((timber) => (
                  <RevealItem key={timber.name}>
                    <div className="rounded-[1.75rem] border border-cream/10 p-5 transition-colors duration-300 hover:border-terracotta/40">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="font-display text-lg font-black text-cream">
                          {timber.name}
                        </h3>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-cream/40">
                          {timber.species}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-cream/55">
                        <span>{timber.tone}</span>
                        <span aria-hidden="true">·</span>
                        <span>{timber.use}</span>
                        <span className="ml-auto" title="Janka hardness scale">
                          {"▮".repeat(timber.hardness)}
                          <span className="text-cream/20">
                            {"▮".repeat(10 - timber.hardness)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </RevealItem>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- budget */}
      <section id="offers" className="scroll-mt-28 bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.1}>
            <RevealItem>
              <p className="text-eyebrow text-terracotta">What things cost</p>
            </RevealItem>
            <RevealItem>
              <h2 className="mt-6 max-w-3xl text-display text-espresso text-[clamp(2.25rem,5vw,4rem)]">
                Indicative ranges, so you can size it early.
              </h2>
            </RevealItem>
            <RevealItem>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-espresso/60">
                Every quote is fixed after the drawing. These bands simply tell you
                which conversation you are having.
              </p>
            </RevealItem>
          </Reveal>

          <Reveal stagger={0.1} delay={0.15} className="mt-12">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {BUDGETS.map((band) => (
                <RevealItem key={band.range}>
                  <div className="h-full rounded-[2rem] bg-white p-7 shadow-soft">
                    <p className="font-display text-xl font-black text-espresso">{band.range}</p>
                    <p className="mt-3 text-sm leading-relaxed text-espresso/60">{band.note}</p>
                  </div>
                </RevealItem>
              ))}
            </div>
          </Reveal>

          <Reveal stagger={0.1} delay={0.25} className="mt-14">
            <div className="flex flex-col items-start gap-6 rounded-[2.5rem] bg-sage p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-display text-[clamp(1.75rem,4vw,2.75rem)] text-cream">
                  Tell us what you have in mind.
                </h2>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-cream/75">
                  A photo of the room, a sketch, or three sentences is genuinely
                  enough to start. We reply within two working days.
                </p>
              </div>
              <PillButton href="/contact#quote" variant="cream" size="lg">
                Get a Quote
              </PillButton>
            </div>
          </Reveal>

          <p className="mt-10 text-center text-sm text-espresso/45">
            Or browse the{" "}
            <Link
              href="/furniture"
              className="text-terracotta underline underline-offset-4 hover:text-espresso"
            >
              ready-made catalogue
            </Link>{" "}
            if you would rather not wait for a drawing.
          </p>
        </div>
      </section>
    </main>
  );
}
