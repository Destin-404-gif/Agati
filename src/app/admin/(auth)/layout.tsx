import Image from "next/image";
import Link from "next/link";
import { getMedia } from "@/lib/media";
import { SITE } from "@/lib/siteConfig";
import type { MediaAsset } from "@/lib/media-slots";
import { AuthArtwork } from "./AuthArtwork";

/**
 * The shell every signed-out admin page sits in: a split screen. The form is on
 * the right, the brand panel on the left, and on small screens the two stack
 * rather than the form shrinking into a column of its own.
 *
 * The mark comes from the database and the words from `siteConfig`, so this file
 * holds no branding of its own.
 */
export default async function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const media = await getMedia(["logo"]);
  const logo: MediaAsset | null = media.logo ?? null;

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* -------------------------------------------------- brand panel */}
      <aside className="relative isolate flex flex-col justify-between overflow-hidden bg-espresso px-6 py-8 text-cream sm:px-10 lg:px-14 lg:py-12">
        <AuthArtwork className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-70" />

        <Link href="/" className="inline-flex w-fit items-center gap-3">
          {logo ? (
            <Image
              src={logo.url}
              alt={logo.alt || SITE.name}
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              priority
            />
          ) : (
            // No mark uploaded yet: the wordmark carries the brand on its own
            // rather than showing a broken image.
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-cream/25 font-display text-sm font-bold tracking-tight"
            >
              AW
            </span>
          )}
          <span className="font-display text-lg font-semibold tracking-tight">
            {SITE.name}
          </span>
        </Link>

        <div className="max-w-lg py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-terracotta-light">
            Workshop admin
          </p>
          <h2 className="mt-5 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-tight">
            The catalogue, the orders and the photographs, in one place.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/70">
            Upload a picture once and it is live on the site - the banner, the
            gallery, the logo. No rebuild, no redeploy, no editing markup.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-cream/15 pt-6 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-cream/50">
              Made in
            </dt>
            <dd className="mt-1.5 font-display text-base">Musanze</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-cream/50">
              Team
            </dt>
            <dd className="mt-1.5 font-display text-base">Eleven makers</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-cream/50">
              Timber
            </dt>
            <dd className="mt-1.5 font-display text-base">One sawmill</dd>
          </div>
        </dl>
      </aside>

      {/* ---------------------------------------------------- form panel */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}