"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal, RevealItem } from "./Reveal";

/**
 * The storefront gallery: the photographs the workshop published from the admin,
 * as a bento mosaic with a lightbox.
 *
 * The rhythm is deterministic - every sixth tile takes two columns and two rows -
 * so it stays even however many photos are uploaded. Grid rows have fixed
 * heights, so the mosaic cannot reflow as the images arrive.
 */

export interface GalleryPhoto {
  id: number;
  image_url: string;
  thumbnail_url: string | null;
  title: string | null;
  caption: string | null;
  alt_text: string | null;
}

/** Feature tiles break the rhythm: two columns wide, two rows tall. */
const FEATURE_EVERY = 6;

export default function GalleryMosaic({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) =>
        current === null
          ? current
          : (current + delta + photos.length) % photos.length,
      );
    },
    [photos.length],
  );

  /* Escape closes; the arrow keys walk the gallery without leaving the lightbox. */
  useEffect(() => {
    if (openIndex === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close, step]);

  /* The page behind the lightbox must not scroll away underneath it. */
  useEffect(() => {
    if (openIndex === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openIndex]);

  /* Focus moves into the panel, then back to the tile that opened it. */
  useEffect(() => {
    if (openIndex === null) return;
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => returnFocusTo.current?.focus?.();
  }, [openIndex]);

  const active = openIndex === null ? null : photos[openIndex] ?? null;
  /** 1-based position for the counter; only read while the lightbox is open. */
  const position = (openIndex ?? 0) + 1;

  return (
    <>
      <Reveal className="grid auto-rows-[8.5rem] grid-cols-2 gap-4 sm:auto-rows-[11rem] sm:gap-5 lg:auto-rows-[13rem] lg:grid-cols-4">
        {photos.map((photo, index) => (
          <RevealItem
            key={photo.id}
            fade
            className={
              index % FEATURE_EVERY === 0 ? "sm:col-span-2 sm:row-span-2" : undefined
            }
          >
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Enlarge ${photo.title ?? "this photograph"}`}
              className="group relative block h-full w-full overflow-hidden rounded-bento bg-cream-dark text-left shadow-soft transition-shadow duration-500 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso"
            >
            <Image
              src={photo.thumbnail_url ?? photo.image_url}
              alt={photo.alt_text ?? photo.title ?? ""}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
            />

            {(photo.title || photo.caption) && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-espresso/80 via-espresso/25 to-transparent p-4 pt-12 sm:p-5 sm:pt-16">
                {photo.title && (
                  <span className="block font-display text-base font-semibold tracking-[-0.02em] text-cream sm:text-lg">
                    {photo.title}
                  </span>
                )}
                {photo.caption && (
                  <span className="mt-1 hidden max-w-md text-xs leading-relaxed text-cream/70 sm:block sm:text-sm">
                    {photo.caption}
                  </span>
                )}
              </span>
            )}
            </button>
          </RevealItem>
        ))}
      </Reveal>

      {active && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={active.title ?? "Gallery photograph"}
          tabIndex={-1}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          className="fixed inset-0 z-200 flex flex-col bg-espresso/95 backdrop-blur-sm focus:outline-none motion-safe:animate-[fadeIn_.2s_ease-out]"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <p className="text-eyebrow text-cream/55">
              {position} / {photos.length}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Close the lightbox"
              className="rounded-full p-2 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* The empty space around the photograph is the backdrop: it closes. */}
          <div
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
            className="flex min-h-0 flex-1 items-center justify-center px-4 pb-5 sm:px-8"
          >
            <figure className="flex h-full w-full max-w-6xl flex-col items-center justify-center gap-4">
              <div className="relative min-h-0 w-full flex-1">
                <Image
                  src={active.image_url}
                  alt={active.alt_text ?? active.title ?? ""}
                  fill
                  sizes="(max-width: 1024px) 100vw, 80vw"
                  className="object-contain"
                />
              </div>

              {(active.title || active.caption) && (
                <figcaption className="max-w-2xl shrink-0 text-center">
                  {active.title && (
                    <p className="font-display text-lg font-semibold tracking-[-0.02em] text-cream">
                      {active.title}
                    </p>
                  )}
                  {active.caption && (
                    <p className="mt-2 text-sm leading-relaxed text-cream/65">
                      {active.caption}
                    </p>
                  )}
                </figcaption>
              )}
            </figure>
          </div>

          {photos.length > 1 && (
            <>
              <LightboxArrow side="previous" onClick={() => step(-1)} />
              <LightboxArrow side="next" onClick={() => step(1)} />
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Previous / next control, pinned to the edge of the lightbox. */
function LightboxArrow({
  side,
  onClick,
}: {
  side: "previous" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "previous" ? "Previous photograph" : "Next photograph"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-cream/10 p-3 text-cream/80 backdrop-blur-sm transition-colors hover:bg-cream/20 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream ${
        side === "previous" ? "left-3 sm:left-6" : "right-3 sm:right-6"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={side === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}
