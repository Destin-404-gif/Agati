import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { TeamGrid } from "@/components/TeamGrid";
import { getMedia, pageHeroSlot } from "@/lib/media";

export const metadata: Metadata = {
  title: "Team",
  description:
    "The makers behind Agati Wood Works - the people who run the sawmill, fill the drying racks and keep the furniture repairable.",
};

// The roster and the banner come from the database.
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const slot = pageHeroSlot("team");
  const media = await getMedia([slot]);

  return (
    <main>
      <PageHero
        eyebrow="Team"
        title={"Meet our\nteam"}
        intro="Sawyers, joiners and finishers who would rather mend a chair than sell you a new one - eleven hands and a very well-used bench."
        image={media[slot] ?? null}
        crumbs={[{ label: "Home", href: "/" }, { label: "Team" }]}
      />

      <section className="bg-cream py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          <TeamGrid />
        </div>
      </section>
    </main>
  );
}