"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { NavigationIcon } from "./NavigationIcon";
import type { NavigationData, NavbarKey } from "@/lib/navigation-data";
import SearchBar from "./SearchBar";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  navigation: NavigationData;
};

/** Slide-in drawer with an accordion catalogue, a search field and quick links. */
export default function MobileDrawer({ open, onClose, navigation }: MobileDrawerProps) {
  const [expandedNavbar, setExpandedNavbar] = useState<NavbarKey | null>(null);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-[60] bg-espresso/50 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            role="dialog"
            aria-label="Menu"
            aria-modal="true"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-[61] flex w-[min(24rem,92vw)] flex-col bg-cream shadow-lift lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-espresso/10 px-5 py-4">
              <p className="font-display text-lg font-black uppercase tracking-[-0.02em] text-espresso">
                AGATI <span className="text-[9px] font-semibold tracking-[0.3em] text-espresso/50">WOOD WORKS</span>
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-full text-espresso/60 transition-colors hover:bg-espresso/5 hover:text-espresso"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="shrink-0 border-b border-espresso/10 px-4 py-4">
              <SearchBar variant="drawer" onNavigate={onClose} />
            </div>

            <nav aria-label="Catalogue" className="flex-1 overflow-y-auto px-4 py-3">
              {([
                { key: "top_bar" as const, label: "Top bar" },
                { key: "category_bar" as const, label: "Category bar" },
              ]).map((bar) => {
                const isOpen = expandedNavbar === bar.key;
                return (
                  <section key={bar.key} className="border-b border-espresso/10">
                    <button type="button" aria-expanded={isOpen} onClick={() => setExpandedNavbar(isOpen ? null : bar.key)} className="flex w-full items-center justify-between px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-espresso/50">
                      {bar.label}<ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-2">
                        {navigation[bar.key].map((item) => {
                          const itemOpen = expandedItem === item.id;
                          const itemHref = item.navbar === "category_bar" ? `/category/${item.slug}` : `/${item.slug}`;
                          const groups = item.sections.reduce<Record<string, typeof item.sections>>((result, section) => {
                            (result[section.group_label] ??= []).push(section);
                            return result;
                          }, {});
                          return <div key={item.id} className="border-t border-espresso/5">
                            <div className="flex items-center">
                              <Link href={itemHref} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta"><NavigationIcon name={item.icon} /></span>
                                <span className="truncate text-[13px] font-semibold text-espresso">{item.label}</span>
                              </Link>
                              {item.has_mega_menu && <button type="button" aria-expanded={itemOpen} onClick={() => setExpandedItem(itemOpen ? null : item.id)} aria-label={`${itemOpen ? "Collapse" : "Expand"} ${item.label}`} className="flex size-10 items-center justify-center rounded-full text-espresso/50"><ChevronDown className={`size-4 transition-transform ${itemOpen ? "rotate-180" : ""}`} /></button>}
                            </div>
                            {item.has_mega_menu && itemOpen && <div className="pb-2 pl-12">
                              {Object.entries(groups).map(([group, sections]) => <div key={group}>
                                <p className="px-2 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-espresso/40">{group}</p>
                                {sections.map((section) => <Link key={section.id} href={`${itemHref}/${section.slug}`} onClick={onClose} className="flex items-center gap-2 px-2 py-2 text-[13px] text-espresso/65"><NavigationIcon name={section.icon} className="size-3.5 shrink-0" />{section.name}</Link>)}
                              </div>)}
                            </div>}
                          </div>;
                        })}
                      </motion.div>}
                    </AnimatePresence>
                  </section>
                );
              })}
            </nav>

            <div className="shrink-0 border-t border-espresso/10 px-5 py-5">
              <Link
                href="/contact#quote"
                onClick={onClose}
                className="block rounded-full bg-espresso px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta"
              >
                Request a Quote
              </Link>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {[
                  { label: "Home", href: "/" },
                  { label: "Projects", href: "/projects" },
                  { label: "Gallery", href: "/gallery" },
                  { label: "Team", href: "/team" },
                  { label: "Services", href: "/services" },
                  { label: "About", href: "/about" },
                  { label: "Contact", href: "/contact" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso/55 transition-colors hover:text-espresso"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}