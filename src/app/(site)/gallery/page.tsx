import type { Metadata } from "next";
import GalleryComingSoon from "@/components/GalleryComingSoon";
import GalleryMosaic from "@/components/GalleryMosaic";
import PageHero from "@/components/PageHero";
import { getPublishedGalleryItems } from "@/lib/gallery";
import { getMedia, pageHeroSlot } from "@/lib/media";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Bent ash, bookmatched walnut, hand-cut dovetails, fumed oak and the finishing room - the workshop, up close.",
};

// The banner and the photographs both come from the database.
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const slot = pageHeroSlot("gallery");
  const [media, photos] = await Promise.all([
    getMedia([slot]),
    getPublishedGalleryItems(),
  ]);

  return (
    <main>
      <PageHero
        eyebrow="Gallery"
        title={"The workshop,\nup close"}
        intro={
          photos.length > 0
            ? "Bent backs, bookmatched panels, fumed oak and one very stubborn offcut pile - photographed as the workshop works."
            : "Bent backs, bookmatched panels, fumed oak and one very stubborn offcut pile. We are still editing the new photographs."
        }
        image={media[slot] ?? null}
        crumbs={[{ label: "Home", href: "/" }, { label: "Gallery" }]}
      />

      <section className="bg-cream py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          {photos.length > 0 ? (
            <GalleryMosaic photos={photos} />
          ) : (
            <GalleryComingSoon />
          )}
        </div>
      </section>
    </main>
  );
}
