"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavigationIcon } from "./NavigationIcon";
import type { NavigationItem } from "@/lib/navigation-data";
import type { MenuImage } from "@/lib/menu-image-rules";

/**
 * The source for a menu picture.
 *
 * A panel image is never more than about 500 CSS pixels wide, so the smallest
 * generated variant that still covers a 2x display is plenty. Handing
 * `next/image` the canonical url would point the optimizer at the 3840px file and
 * make it fetch four times the pixels the menu can show.
 */
function panelImageSrc(image: MenuImage): string {
  const smallestUsable = image.variants
    .filter((variant) => variant.width >= 800)
    .sort((a, b) => a.width - b.width)[0];
  return smallestUsable?.url ?? image.imagePath;
}

export function DatabaseMegaMenu({
  items,
  dark,
  openSlug,
  onOpen,
  onClose,
}: {
  items: NavigationItem[];
  dark: boolean;
  openSlug: string | null;
  onOpen: (slug: string) => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const rowRef = useRef<HTMLDivElement>(null);
  const timers = useRef<{ open?: ReturnType<typeof setTimeout>; close?: ReturnType<typeof setTimeout> }>({});
  const [panelTop, setPanelTop] = useState(140);
  const [menuImages, setMenuImages] = useState<Map<string, MenuImage[]>>(new Map());
  const activeItem = items.find((item) => item.slug === openSlug && item.has_mega_menu);
  const activeItemHref = activeItem
    ? activeItem.navbar === "category_bar"
      ? `/category/${activeItem.slug}`
      : `/${activeItem.slug}`
    : "";

  /**
   * The pictures for the panel's right-hand column, keyed by category slug.
   *
   * Keyed by slug and not by id on purpose: a navbar item's `nav_items.id` is not
   * the same number as the `categories.id` a picture is filed under - in this
   * database the two run three apart - while the slug is the one value both tables
   * agree on.
   *
   * Fetched once per page rather than per open, so sliding between categories
   * stays instant - the same reason the panel itself is already in memory. A
   * failed request leaves the map empty, which renders exactly as a category with
   * no pictures: the section list takes the full width.
   */
  useEffect(() => {
    if (items.length === 0) return;

    let cancelled = false;
    void fetch("/api/menu-images", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { items?: MenuImage[] };
      })
      .then((data) => {
        if (cancelled || !data?.items) return;
        const grouped = new Map<string, MenuImage[]>();
        for (const image of data.items) {
          const bucket = grouped.get(image.categorySlug);
          if (bucket) bucket.push(image);
          else grouped.set(image.categorySlug, [image]);
        }
        setMenuImages(grouped);
      })
      .catch(() => {
        /* No pictures is a valid state; the panel opens without them. */
      });

    return () => {
      cancelled = true;
    };
  }, [items.length]);

  const images = activeItem ? menuImages.get(activeItem.slug) ?? [] : [];

  useEffect(() => {
    const measure = () => {
      const header = rowRef.current?.closest("header");
      setPanelTop((header?.getBoundingClientRect().bottom ?? 130) + 8);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    const currentTimers = timers.current;
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      if (currentTimers.open) clearTimeout(currentTimers.open);
      if (currentTimers.close) clearTimeout(currentTimers.close);
    };
  }, [openSlug]);

  const closeLater = useCallback(() => {
    if (timers.current.open) clearTimeout(timers.current.open);
    timers.current.close = setTimeout(onClose, 180);
  }, [onClose]);

  const openLater = useCallback(
    (slug: string) => {
      if (timers.current.close) clearTimeout(timers.current.close);
      // Once a panel is already up, sliding between categories switches it
      // immediately - the intent delay only exists so a cursor sweeping past the
      // row on its way somewhere else does not open a menu at all.
      if (openSlug) {
        if (timers.current.open) clearTimeout(timers.current.open);
        onOpen(slug);
        return;
      }
      timers.current.open = setTimeout(() => onOpen(slug), 100);
    },
    [onOpen, openSlug],
  );

  const groups = activeItem?.sections.reduce<Record<string, typeof activeItem.sections>>((result, section) => {
    (result[section.group_label] ??= []).push(section);
    return result;
  }, {}) ?? {};

  return (
    <div ref={rowRef} className="relative mx-auto flex h-14 max-w-site items-center px-gutter" onMouseLeave={closeLater} onMouseEnter={() => timers.current.close && clearTimeout(timers.current.close)}>
      <nav aria-label="Category navigation" className="mx-auto flex w-full items-center justify-center gap-2 overflow-x-auto no-scrollbar">
        {items.map((item) => {
          const itemHref = item.navbar === "category_bar" ? `/category/${item.slug}` : `/${item.slug}`;
          const active = pathname === itemHref || pathname.startsWith(`${itemHref}/`);
          const className = `flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-normal transition-colors ${dark
            ? active || openSlug === item.slug
              ? "bg-white/15 text-white"
              : "text-white hover:bg-white/10"
            : active || openSlug === item.slug
              ? "bg-neutral-100 text-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"}`;
          return item.has_mega_menu ? (
            <button key={item.id} type="button" aria-haspopup="true" aria-expanded={openSlug === item.slug} onMouseEnter={() => openLater(item.slug)} onFocus={() => onOpen(item.slug)} onClick={() => openSlug === item.slug ? onClose() : onOpen(item.slug)} className={className}>
              <NavigationIcon name={item.icon} />{item.label}
            </button>
          ) : (
            <Link key={item.id} href={itemHref} onMouseEnter={() => closeLater()} onClick={onClose} className={className}>
              <NavigationIcon name={item.icon} />{item.label}
            </Link>
          );
        })}
      </nav>
      {activeItem && (
        <>
          {/* `top` is the header's measured bottom edge, so the dim layer starts
              below the navbar and the category bar and covers page content only.
              It must not be `inset-0`: that reached up over both rows and ate
              their pointer events, leaving the header greyed and unclickable. */}
          <div
            aria-hidden="true"
            onClick={onClose}
            style={{ top: panelTop }}
            className="fixed inset-x-0 bottom-0 z-[5] bg-black/15 backdrop-blur-[2px]"
          />
          <section role="menu" aria-label={`${activeItem.label} menu`} style={{ top: panelTop }} onMouseEnter={() => timers.current.close && clearTimeout(timers.current.close)} onMouseLeave={closeLater} className="fixed left-1/2 z-10 w-[min(1040px,calc(100vw-48px))] -translate-x-1/2 rounded-3xl border border-neutral-200 bg-[#f6f6f4] p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]">
            <header className="mb-5 flex items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-neutral-900">{activeItem.label}</h2>
                {activeItem.description && <p className="mt-1 text-sm text-neutral-500">{activeItem.description}</p>}
              </div>
              <Link href={activeItemHref} onClick={onClose} className="text-sm font-semibold text-neutral-700 hover:text-terracotta">View all</Link>
            </header>
            {/* One column when the category has no pictures, two when it does -
                which is exactly the space that was sitting empty beside a single
                "Shop by type" group. The section list itself is untouched. */}
            <div
              className={
                images.length
                  ? "grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
                  : "grid grid-cols-1"
              }
            >
              <div>
                {Object.keys(groups).length ? (
                  <div className={Object.keys(groups).length > 1 ? "grid grid-cols-2 gap-x-10 gap-y-6" : undefined}>
                    {Object.entries(groups).map(([group, sections]) => (
                      <div key={group}>
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{group}</h3>
                        <ul className="space-y-1">
                          {sections.map((section) => (
                            <li key={section.id} className="group flex items-center gap-3 rounded-xl">
                              <Link
                                href={`${activeItemHref}/${section.slug}`}
                                role="menuitem"
                                onClick={onClose}
                                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors group-hover:bg-white"
                              >
                                <span
                                  aria-hidden="true"
                                  className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-700"
                                >
                                  <NavigationIcon name={section.icon} className="size-5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-neutral-900">{section.name}</span>
                                  <span className="block truncate text-xs text-neutral-500">{section.description}</span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : <p className="py-8 text-center text-sm text-neutral-500">No sections are available yet.</p>}
              </div>
              {images.length > 0 && (
                /* One picture fills the column; two sit side by side; three are
                   one large over two small, in a fixed-height grid so a category
                   with the most pictures cannot push the panel off the screen. */
                <div className="flex flex-col justify-center">
                  <div
                    className={
                      images.length === 3
                        ? "grid h-96 grid-cols-2 grid-rows-[1.25fr_1fr] gap-3"
                        : images.length === 2
                          ? "grid grid-cols-2 gap-3"
                          : undefined
                    }
                  >
                    {images.map((image, index) => (
                      <Link
                        key={image.id}
                        href={image.linkUrl ?? activeItemHref}
                        onClick={onClose}
                        className={`group relative block overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 ${images.length === 3 && index === 0 ? "col-span-2" : ""}`}
                      >
                        <Image
                          src={panelImageSrc(image)}
                          alt={image.alt}
                          width={image.width ?? 1200}
                          height={image.height ?? 900}
                          sizes="(min-width: 1024px) 480px, 100vw"
                          loading="lazy"
                          decoding="async"
                          className={`w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                            images.length === 1
                              ? "aspect-[16/9]"
                              : images.length === 3
                                ? "h-full"
                                : "aspect-[4/3]"
                          }`}
                        />
                        {image.caption && (
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-2 text-xs font-medium text-white">
                            {image.caption}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <footer className="mt-5 flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
              <p className="text-sm font-medium text-neutral-800">Need help choosing furniture?</p>
              <Link href="/contact#quote" onClick={onClose} className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">Contact us</Link>
            </footer>
          </section>
        </>
      )}
    </div>
  );
}