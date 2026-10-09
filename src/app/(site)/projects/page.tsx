import type { Metadata } from "next";
import MediaImage from "@/components/MediaImage";
import PageHero from "@/components/PageHero";
import PillButton from "@/components/PillButton";
import { Reveal, RevealItem } from "@/components/Reveal";
import { PROJECTS } from "@/lib/data";
import { getMedia, pageHeroSlot, projectSlot, PROJECT_COUNT } from "@/lib/media";

export const metadata: Metadata = {
  title: "Our Projects",
  description:
    "Commissions delivered by Agati Wood Works: full-wall libraries, hospitality fit-outs, retreats and single commissions in solid hardwood.",
};

// Banners and project photos come from the database, so no prerendering.
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const heroKey = pageHeroSlot("projects");
  const media = await getMedia([
    heroKey,
    ...Array.from({ length: PROJECT_COUNT }, (_, i) => projectSlot(i)),
  ]);

  return (
    <main>
      <PageHero
        eyebrow="Our projects"
        title={"Work that had\nno catalogue page"}
        intro="Every commission started as an awkward room, an unusual dimension, or a piece someone could not find anywhere. Here is what we built, and what it cost to think about."
        image={media[heroKey] ?? null}
        crumbs={[{ label: "Home", href: "/" }, { label: "Our Projects" }]}
      />

      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {PROJECTS.map((project, i) => (
              <Reveal key={project.title} stagger={0.1} delay={(i % 2) * 0.08}>
                <RevealItem>
                  <article className="group h-full overflow-hidden rounded-[2.5rem] bg-white shadow-soft transition-shadow duration-500 hover:shadow-lift">
                    <div className="relative aspect-[7/5] w-full overflow-hidden">
                      <MediaImage
                        asset={media[projectSlot(i)] ?? null}
                        alt={project.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        placeholderLabel={project.title}
                        className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                      />
                      <span className="absolute left-5 top-5 rounded-full bg-cream/90 px-4 py-2 text-[11px] font-semibold tracking-[0.14em] text-espresso backdrop-blur-sm">
                        {project.year}
                      </span>
                    </div>

                    <div className="p-7 sm:p-9">
                      <h2 className="text-display text-[clamp(1.6rem,3vw,2.25rem)] text-espresso">
                        {project.title}
                      </h2>
                      <p className="mt-4 text-[15px] leading-relaxed text-espresso/65">
                        {project.blurb}
                      </p>

                      <dl className="mt-7 grid gap-4 border-t border-espresso/10 pt-6 sm:grid-cols-3">
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.16em] text-espresso/35">
                            Client
                          </dt>
                          <dd className="mt-1.5 text-sm text-espresso/75">{project.client}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.16em] text-espresso/35">
                            Scope
                          </dt>
                          <dd className="mt-1.5 text-sm text-espresso/75">{project.scope}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.16em] text-espresso/35">
                            Timber
                          </dt>
                          <dd className="mt-1.5 text-sm text-espresso/75">{project.timber}</dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                </RevealItem>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.12}>
            <RevealItem>
              <h2 className="max-w-4xl text-display text-espresso text-[clamp(2.25rem,6vw,5rem)]">
                Your room could be next.
              </h2>
            </RevealItem>
            <RevealItem>
              <div className="mt-10">
                <PillButton href="/contact#quote" size="lg">
                  Start a commission
                </PillButton>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
