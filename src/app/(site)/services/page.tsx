import type { Metadata } from "next";
import Link from "next/link";
import MediaImage from "@/components/MediaImage";
import PageHero from "@/components/PageHero";
import PillButton from "@/components/PillButton";
import { Reveal, RevealItem } from "@/components/Reveal";
import { PROCESS, SERVICES } from "@/lib/data";
import {
  getMedia,
  pageHeroSlot,
  serviceSlot,
  SERVICE_COUNT,
  type MediaAsset,
} from "@/lib/media";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Custom furniture, millwork and built-ins, timber supply, restoration and repair, finishing and installation, and trade or contract work.",
};

// Banners and service photos come from the database, so no prerendering.
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const heroKey = pageHeroSlot("services");
  const media = await getMedia([
    heroKey,
    ...Array.from({ length: SERVICE_COUNT }, (_, i) => serviceSlot(i)),
  ]);
  const serviceImage = (index: number): MediaAsset | null =>
    media[serviceSlot(index)] ?? null;

  return (
    <main>
      <PageHero
        eyebrow="Services"
        title={"Six things\nwe actually do"}
        intro="No catch-all, no vague &lsquo;bespoke solutions&rsquo;. Just the work our workshop is genuinely set up to take on, with the honest constraints that come with it."
        image={media[heroKey] ?? null}
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
      />

      {/* ------------------------------------------------------- services */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <div className="space-y-5 lg:space-y-6">
            {SERVICES.map((service, i) => (
              <Reveal key={service.id} stagger={0.1} delay={(i % 2) * 0.07}>
                <RevealItem>
                  <article
                    id={service.id}
                    className="scroll-mt-28 grid gap-8 overflow-hidden rounded-[2.5rem] bg-white p-5 shadow-soft transition-shadow duration-500 hover:shadow-lift lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:p-7"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] bg-cream-dark">
                      <MediaImage
                        asset={serviceImage(i)}
                        alt={service.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 40vw"
                        placeholderLabel={service.title}
                        className="object-cover transition-transform duration-[900ms] ease-out hover:scale-105"
                      />
                    </div>

                    <div className="px-3 pb-3 lg:px-6 lg:py-4">
                      <span className="text-eyebrow text-terracotta">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="mt-4 text-display text-[clamp(1.75rem,3.5vw,2.5rem)] text-espresso">
                        {service.title}
                      </h2>
                      <p className="mt-3 text-[15px] font-medium text-espresso/75">
                        {service.summary}
                      </p>
                      <p className="mt-4 text-[15px] leading-relaxed text-espresso/60">
                        {service.detail}
                      </p>

                      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                        {service.points.map((point) => (
                          <li key={point} className="flex items-start gap-2.5 text-sm text-espresso/70">
                            <span
                              aria-hidden="true"
                              className="mt-2 size-1.5 shrink-0 rounded-full bg-terracotta"
                            />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </RevealItem>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- process */}
      <section className="bg-espresso py-20 text-cream sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.1}>
            <RevealItem>
              <p className="text-eyebrow text-terracotta">Every job, large or small</p>
            </RevealItem>
            <RevealItem>
              <h2 className="mt-6 max-w-3xl text-display text-cream text-[clamp(2.25rem,5.5vw,4.5rem)]">
                The same six steps, whichever service you need.
              </h2>
            </RevealItem>
          </Reveal>

          <Reveal stagger={0.08} delay={0.15} className="mt-14">
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {PROCESS.map((step) => (
                <RevealItem key={step.step}>
                  <li className="h-full rounded-[2rem] border border-cream/10 p-7">
                    <span className="text-display text-3xl text-terracotta">{step.step}</span>
                    <h3 className="mt-4 font-display text-lg font-black text-cream">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-cream/55">{step.body}</p>
                  </li>
                </RevealItem>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ cta */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.12}>
            <RevealItem>
              <h2 className="max-w-4xl text-display text-espresso text-[clamp(2.25rem,6vw,5rem)]">
                Not sure which one you need?
              </h2>
            </RevealItem>
            <RevealItem>
              <p className="mt-7 max-w-md text-[15px] leading-relaxed text-espresso/60">
                Describe the problem rather than the solution. &ldquo;The sofa does
                not fit and the door is awkward&rdquo; is more useful to us than any
                list of dimensions.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-10 flex flex-wrap gap-4">
                <PillButton href="/contact#quote" size="lg">
                  Get a Quote
                </PillButton>
                <PillButton href="/custom-furniture" variant="cream" size="lg">
                  Custom furniture
                </PillButton>
              </div>
            </RevealItem>
          </Reveal>

          <p className="mt-14 text-sm text-espresso/45">
            Also worth reading:{" "}
            <Link href="/projects" className="text-terracotta underline underline-offset-4 hover:text-espresso">
              delivered projects
            </Link>{" "}
            ·{" "}
            <Link href="/gallery" className="text-terracotta underline underline-offset-4 hover:text-espresso">
              workshop gallery
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
