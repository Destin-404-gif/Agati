import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import PageHero from "@/components/PageHero";
import PillButton from "@/components/PillButton";
import QuoteForm from "@/components/QuoteForm";
import { Reveal, RevealItem } from "@/components/Reveal";
import { getMedia, pageHeroSlot } from "@/lib/media";
import { getProductBySlug } from "@/lib/queries";
import {
  ADDRESS_LINES,
  CONTACT,
  LOCATION,
  OPENING_HOURS,
  SITE,
  whatsappLink,
} from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get a quote from ${SITE.name}. Tell us about your room, your timber and your deadline - we reply within two working days. Workshop in ${LOCATION.label}.`,
};

const HERO_KEY = pageHeroSlot("contact");

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const [sp, media] = await Promise.all([searchParams, getMedia([HERO_KEY])]);

  // The quote form can be deep-linked from a product card.
  let productName: string | undefined;
  if (sp.product) {
    try {
      const product = await getProductBySlug(sp.product);
      if (!product) notFound();
      productName = product.name;
    } catch (err) {
      console.error("[contact] could not load product", err);
      notFound();
    }
  }

  return (
    <main>
      <PageHero
        eyebrow="Contact us"
        title={"Tell us about\nyour room"}
        intro="Three sentences is genuinely enough to start. A photo of the space, the rough dimensions, and what is not working - we will take it from there."
        image={media[HERO_KEY] ?? null}
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact Us" }]}
      />

      {/* ------------------------------------------------- studios + form */}
      <section id="quote" className="scroll-mt-28 bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <Reveal stagger={0.1}>
              <RevealItem>
                <p className="text-eyebrow text-terracotta">Get a quote</p>
              </RevealItem>
              <RevealItem>
                <h2 className="mt-6 text-display text-espresso text-[clamp(2rem,4.5vw,3.25rem)]">
                  {productName ? (
                    <>
                      Ask about{" "}
                      <span className="text-terracotta">{productName}</span>
                    </>
                  ) : (
                    "Start an enquiry"
                  )}
                </h2>
              </RevealItem>
              <RevealItem>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-espresso/60">
                  Everything is answered by the people who will actually make it.
                  No sales team, no auto-replies.
                </p>
              </RevealItem>
              <RevealItem>
                <div className="mt-9">
                  <QuoteForm productName={productName} />
                </div>
              </RevealItem>
            </Reveal>

            <Reveal stagger={0.12} delay={0.12} className="flex flex-col gap-5">
              <RevealItem>
                <div className="rounded-[2.5rem] bg-espresso p-7 text-cream sm:p-8">
                  <p className="text-eyebrow text-terracotta">Email</p>
                  <a
                    href={CONTACT.emailHref}
                    className="mt-4 block break-all font-display text-xl font-black transition-colors hover:text-terracotta"
                  >
                    {CONTACT.email}
                  </a>
                  <p className="mt-6 text-sm leading-relaxed text-cream/55">
                    Enquiries are answered within two working days. For anything
                    urgent about an existing order, call or WhatsApp the workshop
                    directly.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a
                      href={CONTACT.phoneHref}
                      className="inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:bg-terracotta hover:text-cream"
                    >
                      <Phone className="size-3.5" aria-hidden="true" />
                      {CONTACT.phone}
                    </a>
                    <a
                      href={whatsappLink(
                        `Hello ${SITE.name}, I would like to talk about a piece of furniture.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-cream/25 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:border-terracotta hover:text-terracotta"
                    >
                      <MessageCircle className="size-3.5" aria-hidden="true" />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </RevealItem>

              <RevealItem>
                <div className="rounded-[2.5rem] bg-white p-7 shadow-soft sm:p-8">
                  <h3 className="text-display text-xl text-espresso">The workshop</h3>
                  <address className="mt-4 space-y-1 text-sm not-italic leading-relaxed text-espresso/60">
                    {ADDRESS_LINES.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                  <dl className="mt-6 space-y-2 border-t border-espresso/10 pt-5 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-espresso/40">Hours</dt>
                      <dd className="text-right text-espresso/70">{OPENING_HOURS.label}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-espresso/40">Tel</dt>
                      <dd className="text-right text-espresso/70">{CONTACT.phone}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-espresso/40">Where</dt>
                      <dd className="text-right text-espresso/70">{LOCATION.label}</dd>
                    </div>
                  </dl>
                </div>
              </RevealItem>

              <RevealItem>
                <div className="rounded-[2.5rem] bg-sage p-7 sm:p-8">
                  <h3 className="text-display text-xl text-cream">Not ready to talk?</h3>
                  <p className="mt-3 text-sm leading-relaxed text-cream/70">
                    Have a look at what we have already made, or pick a piece from the
                    catalogue and come back to it.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <PillButton href="/furniture" variant="cream" size="sm">
                      Furniture
                    </PillButton>
                    <PillButton href="/projects" variant="outline" size="sm">
                      Projects
                    </PillButton>
                  </div>
                </div>
              </RevealItem>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- faqs */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <Reveal stagger={0.1}>
            <RevealItem>
              <p className="text-eyebrow text-terracotta">Before you ask</p>
            </RevealItem>
            <RevealItem>
              <h2 className="mt-6 max-w-3xl text-display text-espresso text-[clamp(2rem,4.5vw,3.5rem)]">
                The four questions we always get.
              </h2>
            </RevealItem>
          </Reveal>

          <Reveal stagger={0.1} delay={0.15} className="mt-14">
            <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
              {[
                {
                  q: "How long does a commission take?",
                  a: "Six to ten weeks for most furniture, longer for staircases or full-wall built-ins. We will give you a real date in the quote rather than the optimistic one.",
                },
                {
                  q: "Do you deliver outside Musanze?",
                  a: "Our own delivery team covers Musanze and the northern districts - Burera, Gicumbi, Rulindo, Gakenke and Nyabiraba. Further afield we will happily discuss collection or a freight quote; tell us where you are in the form above.",
                },
                {
                  q: "Can you match my existing furniture?",
                  a: "Often, yes. Bring a photo of a piece you like and something of ours, and we will tell you honestly whether the match is achievable or whether you will end up with two different chairs.",
                },
                {
                  q: "What if I need it cheaper?",
                  a: "We will say so rather than cut the timber grade on you quietly. Usually the answer is a smaller piece, a simpler joint, or a different species - all of which we will price openly.",
                },
              ].map((item) => (
                <RevealItem key={item.q}>
                  <div className="h-full rounded-[2rem] bg-cream p-7">
                    <h3 className="font-display text-lg font-black text-espresso">{item.q}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-espresso/60">{item.a}</p>
                  </div>
                </RevealItem>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
