/**
 * Placeholder for the gallery while the workshop photographs are being shot
 * and edited. Stands in for the previous bento mosaic of tiles: no images, no
 * lightbox, no client-side JS.
 */
export default function GalleryComingSoon() {
  return (
    <div className="flex flex-col items-center rounded-[2.5rem] border border-dashed border-espresso/20 bg-cream-dark/40 px-6 py-20 text-center sm:px-12 sm:py-24 lg:py-28">
      <p className="text-eyebrow text-terracotta">Coming soon</p>

      <h2 className="mt-6 max-w-2xl font-display text-[clamp(1.9rem,4.5vw,3.25rem)] font-black leading-[1.05] tracking-[-0.03em] text-espresso">
        Our gallery isn&rsquo;t ready yet
      </h2>

      <p className="mt-6 max-w-md text-[15px] leading-relaxed text-espresso/70">
        We&rsquo;re still preparing our photos. Please check back soon.
      </p>
    </div>
  );
}
