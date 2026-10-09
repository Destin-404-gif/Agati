"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowRight, Heart, Mail, Menu, Phone, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { CONTACT, SITE } from "@/lib/siteConfig";
import type { MediaAsset } from "@/lib/media-slots";
import { DatabaseMegaMenu } from "./DatabaseMegaMenu";
import MobileDrawer from "./MobileDrawer";
import SearchBar from "./SearchBar";
import type { NavigationData } from "@/lib/navigation-data";

/** Cart link with a live item-count badge from the local cart. */
function CartButton({ className }: { className: string }) {
  const { count, ready } = useCart();

  return (
    <Link
      href="/cart"
      title="Your cart"
      aria-label={
        ready && count > 0 ? `Cart - ${count} item${count === 1 ? "" : "s"}` : "Cart - empty"
      }
      className={className}
    >
      <span className="relative">
        <ShoppingBag className="size-5" aria-hidden="true" />
        {/* `ready` keeps the badge off the server render, so there is no
            hydration mismatch while localStorage is being read. */}
        {ready && count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold leading-none text-cream">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
    </Link>
  );
}

function BrandLogo({ logo }: { logo: MediaAsset | null }) {
  return (
    <Link
      href="/"
      aria-label={`${SITE.name} - home`}
      className="group flex shrink-0 items-center"
    >
      {logo ? (
        <Image
          src={logo.url}
          alt={SITE.name}
          width={96}
          height={84}
          priority
          className="h-12 w-auto shrink-0 object-contain transition-opacity duration-300 group-hover:opacity-90"
        />
      ) : (
        <span className="font-display text-2xl font-black uppercase tracking-[-0.03em] text-espresso">
          Agati
        </span>
      )}
    </Link>
  );
}

/**
 * Three-row storefront header, all in normal document flow:
 *
 *   Row 1 (40px, hidden below md): contact details + quick links.
 *   Row 2 (80px): logo | search / wishlist / account / cart / quote.
 *   Row 3 (56px, below lg → drawer): the ten category pills + mega-menu.
 *
 * Transparency over the hero is a plain gradient background (no absolute
 * layers); after 40px of scroll the header becomes frosted white glass, Row 1
 * collapses and Row 2/3 compact. `--header-h` is kept in sync so no hero
 * content ever sits under the header.
 *
 * `logo` and `categoryImages` come from `media_slots`, read once in the site
 * layout. A slot with no image falls back to the wordmark here, and to the
 * neutral placeholder in the mega-menu.
 */
export default function Navbar({
  logo,
  navigation,
}: {
  logo: MediaAsset | null;
  navigation: NavigationData;
}) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const headerRef = useRef<HTMLElement>(null);
  const scrolledRef = useRef(false);

  const [navData, setNavData] = useState(navigation);
  const [scrolled, setScrolled] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const syncHeaderVar = (isScrolled: boolean) => {
    const vw = window.innerWidth;
    let height: string;
    if (isScrolled) {
      height = vw >= 1024 ? "108px" : "64px"; // essential + shrunken rows
    } else if (vw >= 1024) {
      height = "176px"; // 40 + 80 + 56
    } else if (vw >= 768) {
      height = "120px"; // 40 + 80 (category row hidden)
    } else {
      height = "80px"; // brand row only
    }
    document.documentElement.style.setProperty("--header-h", height);
  };

  useMotionValueEvent(scrollY, "change", (latest) => {
    const next = latest > 40;
    scrolledRef.current = next;
    setScrolled(next);
    syncHeaderVar(next);
  });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/navigation", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as NavigationData;
        if (!cancelled) setNavData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    syncHeaderVar(scrolledRef.current);
    const onResize = () => syncHeaderVar(scrolledRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Route change: close every transient layer. The router is the external
  // system here - this effect is how React synchronises with its updates.
  useEffect(() => {
    setOpenSlug(null);
    setDrawerOpen(false);
    setOverlayOpen(false);
  }, [pathname]);

  // Clicking anywhere outside the header closes the mega-menu.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenSlug(null);
        setOverlayOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const isHome = pathname === "/";
  const menuOpen = openSlug !== null;
  const transparent = isHome && !scrolled && !openSlug && !drawerOpen && !overlayOpen;
  const dark = transparent; // cream-on-dark palette

  const iconButton = (active: boolean) =>
    [
      "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
      dark
        ? active
          ? "bg-white/15 text-white"
          : "text-white/85 hover:bg-white/10 hover:text-white"
        : active
          ? "bg-neutral-100 text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
    ].join(" ");

  const utilityLink = dark
    ? "text-white/75 transition-colors duration-200 hover:text-white"
    : "text-neutral-500 transition-colors duration-200 hover:text-neutral-900";
  const divider = dark ? "self-center w-px bg-white/25" : "self-center w-px bg-neutral-300";

  return (
    <>
      <header
        ref={headerRef}
        className={[
          "fixed inset-x-0 top-0 z-50 transition-colors duration-500 ease-out",
          dark
            ? "bg-gradient-to-b from-black/45 via-black/20 to-transparent"
            : menuOpen
              // Solid and unfiltered while a menu is open. A backdrop-filter here
              // both smears the menu's dim layer up into the navbar and makes the
              // header the containing block for the menu's `fixed` overlay and
              // panel, which are positioned against the viewport.
              ? "bg-white shadow-[0_10px_40px_-14px_rgba(0,0,0,0.18)]"
              : "bg-white/85 shadow-[0_10px_40px_-14px_rgba(0,0,0,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75",
        ].join(" ")}
      >
        {/* The rows are `relative z-[6]` so they are genuinely positioned above
            the mega-menu's dim overlay (z-[5]). `z-index` does not apply to
            static boxes, so on this wrapper alone the overlay used to win. */}
        <div className="relative z-[6]">
          {/* ------------------------------------------------ Row 1: utility */}
          <div
            className={[
              "relative z-[6] mx-auto hidden h-10 max-w-site items-center justify-between gap-8 overflow-hidden px-gutter transition-[max-height,opacity] duration-500 ease-out md:flex xl:gap-12",
              scrolled ? "max-h-0 opacity-0" : "max-h-10 opacity-100",
            ].join(" ")}
          >
            <div className="flex min-w-0 shrink-0 items-center gap-7">
              <a
                href={CONTACT.phoneHref}
                className={["flex items-center gap-2 text-[11px] uppercase tracking-wider", utilityLink].join(" ")}
              >
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {CONTACT.phone}
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className={["flex max-w-full items-center gap-2 text-[11px] uppercase tracking-wider", utilityLink].join(" ")}
              >
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{CONTACT.email}</span>
              </a>
            </div>

            <nav
              aria-label="Utility pages"
              className="flex min-w-0 shrink-0 items-center gap-6 text-[11px] uppercase tracking-wider xl:gap-7"
            >
              {navData.top_bar.map((link, i) => (
                <span key={link.id} className="flex shrink-0 items-center gap-6 xl:gap-7">
                  {i > 0 && <span aria-hidden="true" className={divider + " h-3"} />}
                  <Link href={`/${link.slug}`} className={utilityLink}>
                    {link.label}
                  </Link>
                </span>
              ))}
            </nav>
          </div>

          {/* ------------------------------------------------ Row 2: brand + actions */}
          <div
            className={[
              "relative z-[6] mx-auto flex max-w-site items-center justify-between gap-8 px-gutter transition-all duration-500 ease-out xl:gap-10",
              scrolled ? "h-16" : "h-20",
            ].join(" ")}
          >
            <BrandLogo logo={logo} />

            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3 lg:gap-4">
              <button
                type="button"
                onClick={() => setOverlayOpen(true)}
                aria-label="Open search"
                className={iconButton(false)}
              >
                <Search className="size-5" aria-hidden="true" />
              </button>

              <Link
                href="/furniture?featured=true"
                title="Featured pieces - our hand-picked selection"
                aria-label="Wishlist - featured pieces"
                className={iconButton(false) + " hidden sm:flex"}
              >
                <Heart className="size-5" aria-hidden="true" />
              </Link>

              <Link
                href="/contact"
                title="Talk to the workshop"
                aria-label="Account - talk to the workshop"
                className={iconButton(false) + " hidden sm:flex"}
              >
                <User className="size-5" aria-hidden="true" />
              </Link>

              <CartButton className={iconButton(false) + " hidden md:flex"} />

              <Link
                href="/contact#quote"
                className={[
                  "hidden h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-all duration-300 hover:bg-neutral-700 active:scale-[0.98] lg:ml-3 lg:inline-flex",
                  dark ? "bg-neutral-900/80" : "bg-neutral-900",
                ].join(" ")}
              >
                Request a Quote
                <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
              </Link>

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                aria-expanded={drawerOpen}
                className={iconButton(false) + " lg:hidden"}
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ------------------------------------------------ Row 3: categories */}
          <div
            className={[
              "relative z-[6] hidden border-t lg:block",
              dark ? "border-white/15" : "border-black/10",
            ].join(" ")}
          >
            <DatabaseMegaMenu dark={dark} items={navData.category_bar} openSlug={openSlug} onOpen={setOpenSlug} onClose={() => setOpenSlug(null)} />
          </div>
        </div>
      </header>

      {/* --------------------------------------------- search overlay */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-start justify-center bg-espresso/60 px-4 pt-16 backdrop-blur-sm"
            onClick={() => setOverlayOpen(false)}
          >
            <motion.div
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-eyebrow text-cream">Search the catalogue</p>
                <button
                  type="button"
                  onClick={() => setOverlayOpen(false)}
                  aria-label="Close search"
                  className="flex size-10 items-center justify-center rounded-full text-cream transition-colors hover:bg-cream/10"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <SearchBar tone="light" variant="drawer" showCategory autoFocus onNavigate={() => setOverlayOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navData} />
    </>
  );
}