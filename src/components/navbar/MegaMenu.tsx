"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import {
  categoryHref,
  findCategory,
  moreCategories,
  primaryCategories,
  subcategoryHref,
  type Category,
} from "@/lib/navigation";
import { categorySlot, type MediaAsset } from "@/lib/media-slots";

type MegaMenuProps = {
  tone: "dark" | "light";
  scrolled: boolean;
  openSlug: string | null;
  onOpen: (slug: string) => void;
  onClose: () => void;
  /** Resolved `category_<slug>` panels, keyed by slot key. */
  categoryImages: Record<string, MediaAsset | null>;
  categorySlugs: string[];
};

const MORE_SLUG = "__more__";

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

/**
 * Hover-intent navigation with a single floating panel.
 *
 * Matches the reference: a rounded white/cream panel that floats under the
 * trigger row (12px gap bridged by an invisible strip), a dimmed blurred
 * backdrop behind it, and content that crossfades as the hovered category
 * changes. The panel is rendered `fixed` and re-measured against the row so it
 * stays dead-centre regardless of how the grid columns are laid out.
 *
 * Opening is delayed 120ms and closing 200ms so the cursor can travel
 * diagonally through the bridge without the menu flickering. The timers are
 * shared between the trigger row and the panel.
 *
 * Responsive triggers: the six flagship categories are inline from lg; the
 * remaining four join at xl; in between the "More" pill takes over. Below lg
 * the whole thing lives in the mobile drawer, so this component never renders
 * there.
 */
export default function MegaMenu({
  tone,
  scrolled,
  openSlug,
  onOpen,
  onClose,
  categoryImages,
  categorySlugs,
}: MegaMenuProps) {
  const pathname = usePathname();
  const primary = primaryCategories();
  const more = moreCategories();
  const cream = tone === "dark";

  const handlers = useRef({ onOpen, onClose });
  useEffect(() => {
    handlers.current = { onOpen, onClose };
  }, [onOpen, onClose]);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState(0);

  // The panel is rendered `fixed` so it can centre on the viewport and hang
  // under the whole header (not just its trigger row); re-measure its top edge
  // whenever the header's height could have shifted (menu opens, the header
  // collapses on scroll, breakpoints cross).
  useLayoutEffect(() => {
    const measure = () => {
      const el = rowRef.current;
      const header = el?.closest("header");
      const bottom = header ? header.getBoundingClientRect().bottom : (el?.getBoundingClientRect().bottom ?? 0);
      setPanelTop(bottom + 8);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [openSlug, tone, scrolled]);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const requestOpen = useCallback((slug: string) => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => {
      handlers.current.onOpen(slug);
      openTimer.current = null;
    }, OPEN_DELAY_MS);
  }, []);

  const requestClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => {
      handlers.current.onClose();
      closeTimer.current = null;
    }, CLOSE_DELAY_MS);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const isOpen = openSlug != null;
  const activeCategory: Category | undefined =
    openSlug === MORE_SLUG ? undefined : findCategory(openSlug ?? "");

  /** The panel behind a category name, or the first category's, for "More". */
  const panelFor = (slug: string | null): MediaAsset | null =>
    (slug ? categoryImages[categorySlot(slug)] : null) ??
    (categorySlugs.length > 0 ? categoryImages[categorySlot(categorySlugs[0])] : null) ??
    null;

  function isActive(slug: string) {
    const href = categoryHref(slug);
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const pill = (active: boolean) => {
    if (cream) {
      return active
        ? "bg-white/10 text-white ring-1 ring-white/40"
        : "text-white/80 hover:bg-white/10 hover:text-white ring-1 ring-transparent hover:ring-white/25";
    }
    return active
      ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-300"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 ring-1 ring-transparent hover:ring-neutral-200";
  };

  function onRowKeyDown(e: React.KeyboardEvent) {
    const buttons = Array.from(
      rowRef.current?.querySelectorAll<HTMLButtonElement>("[data-mega-trigger]") ?? [],
    );
    const i = buttons.indexOf(e.target as HTMLButtonElement);
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    buttons[(i + delta + buttons.length) % buttons.length]?.focus();
  }

  return (
    <div
      ref={rowRef}
      onMouseEnter={cancelClose}
      onMouseLeave={requestClose}
      className={[
        "mx-auto flex min-w-0 max-w-site items-center overflow-x-auto px-gutter scroll-smooth-x no-scrollbar",
        // Ten pills at 28px gaps overflow the frame from xl up, so that is the
        // only breakpoint where the edge fade has anything to hide.
        "xl:edge-fade-x",
        scrolled ? "h-11" : "h-14",
      ].join(" ")}
    >
      {/* ---------------------------------------------------------- triggers */}
      <nav
        aria-label="Shop by category"
        onKeyDown={onRowKeyDown}
        // `w-max shrink-0` stops the row being squeezed shut; paired with
        // `mx-auto` it centres while it fits and scrolls from the left edge
        // once it does not.
        className="mx-auto flex w-max shrink-0 items-center gap-7 2xl:gap-8"
      >
        {primary.map((category) => {
          const active = openSlug === category.slug || isActive(category.slug);
          return (
            <button
              key={category.slug}
              type="button"
              data-mega-trigger={category.slug}
              aria-haspopup="true"
              aria-expanded={openSlug === category.slug}
              onMouseEnter={() => requestOpen(category.slug)}
              onClick={() => (openSlug === category.slug ? onClose() : onOpen(category.slug))}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                  (e.currentTarget as HTMLButtonElement).focus();
                }
                if ((e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") && !isOpen) {
                  e.preventDefault();
                  onOpen(category.slug);
                }
              }}
              className={[
                "hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors duration-200 lg:inline-flex lg:px-3 xl:px-3",
                pill(active),
              ].join(" ")}
            >
              <category.icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {category.name}
            </button>
          );
        })}

        {more.map((category) => {
          const active = openSlug === category.slug || isActive(category.slug);
          return (
            <button
              key={category.slug}
              type="button"
              data-mega-trigger={category.slug}
              aria-haspopup="true"
              aria-expanded={openSlug === category.slug}
              onMouseEnter={() => requestOpen(category.slug)}
              onClick={() => (openSlug === category.slug ? onClose() : onOpen(category.slug))}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                  (e.currentTarget as HTMLButtonElement).focus();
                }
                if ((e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") && !isOpen) {
                  e.preventDefault();
                  onOpen(category.slug);
                }
              }}
              className={[
                "hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors duration-200 xl:inline-flex xl:px-3",
                pill(active),
              ].join(" ")}
            >
              <category.icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {category.name}
            </button>
          );
        })}

        {/* "More" fills the gap between six inline pills and the full ten. */}
        <button
          type="button"
          data-mega-trigger={MORE_SLUG}
          aria-haspopup="true"
          aria-expanded={openSlug === MORE_SLUG}
          onMouseEnter={() => requestOpen(MORE_SLUG)}
          onClick={() => (openSlug === MORE_SLUG ? onClose() : onOpen(MORE_SLUG))}
          className={[
            "hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors duration-200 lg:inline-flex lg:px-3 xl:hidden",
            pill(openSlug === MORE_SLUG),
          ].join(" ")}
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          More
          <ChevronDown
            className={["size-3 transition-transform duration-200", openSlug === MORE_SLUG ? "rotate-180" : ""].join(" ")}
            aria-hidden="true"
          />
        </button>
      </nav>

      {/* ------------------------------------------------- padding / panel */}
      {/* dim + blur the page behind the menu, keep the header itself legible */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-[5] bg-black/20 backdrop-blur-[2px]"
            />
            <motion.div
              role="menu"
              aria-label={activeCategory ? `${activeCategory.name} subcategories` : "All categories"}
              initial={{ opacity: 0, x: "-50%", y: 8, scale: 0.98 }}
              animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
              exit={{ opacity: 0, x: "-50%", y: 6, scale: 0.99 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={cancelClose}
              onMouseLeave={requestClose}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                  document
                    .querySelector<HTMLButtonElement>(
                      `[data-mega-trigger="${activeCategory?.slug ?? MORE_SLUG}"]`,
                    )
                    ?.focus();
                }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const links = Array.from(
                    (e.currentTarget as HTMLElement).querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
                  );
                  const index = links.indexOf(e.target as HTMLAnchorElement);
                  const next = e.key === "ArrowDown" ? index + 1 : index - 1;
                  (links[(next + links.length) % links.length] ?? links[0])?.focus();
                }
              }}
              style={{ top: panelTop }}
              className="fixed left-1/2 z-10 w-[min(1040px,calc(100vw-48px))]"
            >
              <div className="rounded-[28px] border border-white/70 bg-[#f6f6f4] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={activeCategory?.slug ?? MORE_SLUG}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    {activeCategory ? (
                      /* ------------------------------------------------- category */
                      <div className="grid grid-cols-[340px_1fr] gap-6">
                        <Link
                          href={categoryHref(activeCategory.slug)}
                          onClick={onClose}
                          role="menuitem"
                          className="group relative block min-h-[340px] overflow-hidden rounded-[24px] ring-2 ring-white"
                        >
                          <MediaImage
                            asset={panelFor(activeCategory.slug)}
                            alt=""
                            fill
                            sizes="340px"
                            placeholderLabel={activeCategory.name}
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/30" />
                          <span className="absolute inset-x-0 top-0 flex flex-col gap-1.5 p-6">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                              {activeCategory.name}
                            </span>
                            <span className="text-xl font-medium leading-snug text-white">
                              {activeCategory.featured.title}
                            </span>
                            <span className="line-clamp-2 text-sm leading-snug text-white/85">
                              {activeCategory.featured.description}
                            </span>
                          </span>
                        </Link>

                        <div className="flex flex-col p-6">
                          <div className="grid flex-1 grid-cols-2 gap-x-8">
                            {activeCategory.groups.map((group) => (
                              <div key={group.title} className="min-w-0">
                                <p className="text-sm text-neutral-500">{group.title}</p>
                                <ul className="mt-2 flex flex-col gap-2">
                                  {group.items.map((item) => (
                                    <li key={item.slug}>
                                      <Link
                                        href={subcategoryHref(activeCategory.slug, item.slug)}
                                        onClick={onClose}
                                        role="menuitem"
                                        className="group/link flex items-center gap-4 rounded-2xl p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                                      >
                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition-colors duration-200 group-hover/link:text-neutral-900">
                                          <item.icon className="size-[22px]" strokeWidth={1.25} aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0">
                                          <span className="block truncate text-[15px] font-medium text-neutral-900">
                                            {item.name}
                                          </span>
                                          <span className="block truncate text-sm text-neutral-500">
                                            {item.description}
                                          </span>
                                        </span>
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4 border-t border-neutral-200/80 pt-4">
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold text-neutral-900">
                                Need help choosing furniture?
                              </p>
                              <p className="text-sm text-neutral-500">
                                Our team will help you find the perfect pieces.
                              </p>
                            </div>
                            <Link
                              href="/contact#quote"
                              onClick={onClose}
                              role="menuitem"
                              className="shrink-0 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-neutral-700"
                            >
                              Contact us
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ---------------------------------------------------- "more" */
                      <>
                        <div className="grid grid-cols-2 gap-4 p-6">
                          {more.map((category) => {
                            const active = isActive(category.slug);
                            return (
                              <Link
                                key={category.slug}
                                role="menuitem"
                                href={categoryHref(category.slug)}
                                onClick={onClose}
                                className={[
                                  "group flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md",
                                  active ? "bg-white ring-1 ring-neutral-300" : "",
                                ].join(" ")}
                              >
                                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-700">
                                  <category.icon className="size-7" strokeWidth={1.25} aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[15px] font-medium text-neutral-900">
                                    {category.name}
                                  </span>
                                  <span className="mt-0.5 block truncate text-sm text-neutral-500">
                                    {category.blurb}
                                  </span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                        <div className="mx-6 mb-6 flex items-center justify-between gap-4 border-t border-neutral-200/80 pt-4">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-neutral-900">
                              Need help choosing furniture?
                            </p>
                            <p className="text-sm text-neutral-500">
                              Our team will help you find the perfect pieces.
                            </p>
                          </div>
                          <Link
                            href="/contact#quote"
                            onClick={onClose}
                            role="menuitem"
                            className="shrink-0 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-neutral-700"
                          >
                            Contact us
                          </Link>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}