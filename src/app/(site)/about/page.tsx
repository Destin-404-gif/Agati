import type { Metadata } from "next";
import MediaImage from "@/components/MediaImage";
import PageHero from "@/components/PageHero";
import PillButton from "@/components/PillButton";
import { Reveal, RevealItem } from "@/components/Reveal";
import { STATS, VALUES } from "@/lib/data";
import { getMedia, pageHeroSlot } from "@/lib/media";
import { LOCATION } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Eleven makers, one sawmill, and a stubborn belief that furniture should be repairable rather than disposable. Agati Wood Works in Musanze, Rwanda since 2019.",
};

export const dynamic = "force-dynamic";

const TIMELINE = [
  {
    year: "2019",
    title: "One mill, two people",
    body: "Agati started as a two-man mill beside the road at Bukinanyana in Cyuve, just outside Musanze. The first saw was a secondhand bandsaw and the first order was a set of stools for a restaurant in Musanze town that is still trading.",
  },
    {
      year: "2021",
      title: "The drying racks went up",
      body: "Kiln-dried stock from our own trees, so we stopped waiting three weeks for someone else's timber and started being able to promise a date.",
    },
    {
      year: "2025",
      title: "The showroom opens",
      body: `A shopfront in ${LOCATION.area} where you can sit in the chairs before you commit, talk through a commission face to face, and pay on delivery when the pieces arrive at your door.`,
    },
  ];

export default async function AboutPage() {
  const heroKey = pageHeroSlot("about");
  const media = await getMedia([heroKey, "about_workshop"]);

  return (
    <main>
      <PageHero
        eyebrow="About us"
        title={"We mill it,\nwe cut it, we mend it"}
        intro="Agati Wood Works is a small timber-and-furniture workshop with its own sawmill, its own drying racks, and eleven people who would rather repair a chair than sell you a new one."
        image={media[heroKey] ?? null}
        crumbs={[{ label: "Home", href: "/" }, { label: "About Us" }]}
      />

      {/* ------------------------------------------------------ founder */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <Reveal stagger={0.12}>
              <RevealItem>
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2.5rem] bg-cream-dark shadow-lift">
                  <MediaImage
                    asset={media.about_workshop ?? null}
                    alt="The Agati workshop floor in morning light"
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    placeholderLabel="The workshop floor"
                    className="object-cover"
                  />
                </div>
              </RevealItem>
            </Reveal>

            <Reveal stagger={0.12} delay={0.1} className="flex flex-col justify-center">
              <RevealItem>
                <p className="text-eyebrow text-terracotta">Why we exist</p>
              </RevealItem>
              <RevealItem>
                <h2 className="mt-6 text-display text-espresso text-[clamp(2rem,4.5vw,3.5rem)]">
                  Most furniture is designed to be thrown away.
                </h2>
              </RevealItem>
              <RevealItem>
                <div className="mt-7 space-y-5 text-[15px] leading-relaxed text-espresso/65">
                  <p>
                    A veneer on chipboard, a cam-lock that strips on the third
                    tightening, a lacquer finish that peels rather than wearing.
                    None of it is a workmanship problem. It is a design decision,
                    and it was made because replacement sells more than repair.
                  </p>
                  <p>
                    We decided to go the other way. Solid timber, visible joinery
                    that can be cut again, finishes that sand back. It makes us
                    slower, and it makes our furniture more expensive, and it
                    means a piece we sold you in 2019 is still in use in 2069.
                  </p>
                </div>
              </RevealItem>
              <RevealItem>
                <blockquote className="mt-9 border-l-2 border-terracotta pl-6">
                  <p className="font-display text-xl leading-snug text-espresso">
                    &ldquo;If we cannot show you how to fix it, we have not finished
                    making it.&rdquo;
                  </p>
                  <footer className="mt-3 text-[11px] uppercase tracking-[0.16em] text-espresso/40">
                    Founder&rsquo;s rule, taped above the bench since 2019
                  </footer>
                </blockquote>
              </RevealItem>
              <RevealItem>
                <div className="mt-10 flex flex-wrap gap-4">
                  <PillButton href="/projects" size="lg">
                    See our projects
                  </PillButton>
                  <PillButton href="/contact#quote" variant="cream" size="lg">
                    Get a Quote
                  </PillButton>
                </div>
              </RevealItem>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- timeline */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.1}>
            <RevealItem>
              <p className="text-eyebrow text-terracotta">How we got here</p>
            </RevealItem>
            <RevealItem>
              <h2 className="mt-6 max-w-3xl text-display text-espresso text-[clamp(2.25rem,5vw,4rem)]">
                Seven years, one workshop at a time.
              </h2>
            </RevealItem>
          </Reveal>

          <Reveal stagger={0.12} delay={0.15} className="mt-14">
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {TIMELINE.map((entry) => (
                <RevealItem key={entry.year}>
                  <li className="h-full rounded-[2rem] bg-cream p-7">
                    <span className="text-eyebrow text-terracotta">{entry.year}</span>
                    <h3 className="mt-4 font-display text-xl font-black text-espresso">
                      {entry.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-espresso/60">{entry.body}</p>
                  </li>
                </RevealItem>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------- values */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.1}>
            <RevealItem>
              <p className="text-eyebrow text-terracotta">Four rules</p>
            </RevealItem>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {VALUES.map((value, i) => (
              <Reveal key={value.title} stagger={0.1} delay={0.1 + i * 0.06}>
                <RevealItem>
                  <div className="h-full rounded-[2rem] bg-white p-7 shadow-soft">
                    <span className="text-eyebrow text-espresso/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-4 text-display text-[1.4rem] text-espresso">
                      {value.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-espresso/60">{value.body}</p>
                  </div>
                </RevealItem>
              </Reveal>
            ))}
          </div>

          <Reveal stagger={0.1} delay={0.2} className="mt-16">
            <dl className="grid grid-cols-2 gap-8 border-t border-espresso/10 pt-10 sm:grid-cols-4">
              {STATS.map((stat) => (
                <RevealItem key={stat.v}>
                  <div>
                    <dt className="text-display text-[clamp(2rem,5vw,3.5rem)] text-sage">
                      {stat.k}
                    </dt>
                    <dd className="mt-2 text-[11px] uppercase leading-snug tracking-[0.14em] text-espresso/40">
                      {stat.v}
                    </dd>
                  </div>
                </RevealItem>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- close */}
      <section className="bg-espresso py-20 text-cream sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.12}>
            <RevealItem>
              <h2 className="max-w-4xl text-display text-cream text-[clamp(2.25rem,6vw,5rem)]">
                Come and see the wood.
              </h2>
            </RevealItem>
            <RevealItem>
              <p className="mt-7 max-w-md text-[15px] leading-relaxed text-cream/65">
                We keep open hours on Thursdays. Bring a sketch, or just come and
                pick up a handful of offcuts.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-10 flex flex-wrap gap-4">
                <PillButton href="/contact" variant="cream" size="lg">
                  Contact us
                </PillButton>
                <PillButton href="/gallery" variant="outline" size="lg">
                  Gallery
                </PillButton>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
