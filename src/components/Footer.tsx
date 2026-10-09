"use client";

import Image from "next/image";
import Link from "next/link";
import { createElement } from "react";
import { Hammer, Mail, MapPin, Phone } from "lucide-react";
import type { MediaAsset } from "@/lib/media-slots";
import { BRAND, FOOTER_COLUMNS, LEGALS } from "@/lib/nav";
import { dbCategoryIcon } from "@/lib/navigation";
import {
  ADDRESS_LINES,
  CONTACT,
  LOCATION,
  OPENING_HOURS,
  SITE,
  SOCIALS,
} from "@/lib/siteConfig";
import { Reveal, RevealItem } from "./Reveal";

/** Icon for a footer taxonomy link (?category=armchairs… or the custom page). */
function linkIcon(href: string) {
  const match = href.match(/category=(\w+)/);
  if (match) return dbCategoryIcon(match[1]);
  if (href === "/custom-furniture") return Hammer;
  return undefined;
}

export default function Footer({ logo }: { logo: MediaAsset | null }) {
  return (
    <footer className="bg-espresso pb-10 pt-20 text-cream sm:pt-28">
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
        <Reveal stagger={0.1}>
          {/* ------------------------------------------------ oversized CTA */}
          <RevealItem>
            <h2 className="text-display text-cream text-[clamp(3rem,11vw,8rem)]">
              Let&rsquo;s build
              <span className="text-terracotta">.</span>
            </h2>
          </RevealItem>

          <RevealItem>
<p className="mt-8 max-w-md text-[15px] leading-relaxed text-cream/60">
                Tell us the room, the timber and the deadline. We will come back
                within two working days with drawings and a fixed price - or
                take your order straight from {LOCATION.short}.
              </p>
          </RevealItem>

          <RevealItem>
            <Link
              href="/contact#quote"
              className="mt-9 inline-flex items-center gap-3 rounded-full bg-cream px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-espresso transition-all duration-300 hover:scale-[1.04] hover:bg-terracotta hover:text-cream active:scale-[0.97]"
            >
              Get a Quote
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                <path
                  d="M4 12h15m0 0l-5.5-5.5M19 12l-5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </RevealItem>

          {/* --------------------------------------------------- link columns */}
          <RevealItem>
            <div className="mt-16 grid gap-10 border-t border-cream/10 pt-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
              <div>
                <Link href="/" className="group inline-flex items-center gap-3">
                  {logo ? (
                    <Image
                      src={logo.url}
                      alt={SITE.name}
                      width={88}
                      height={77}
                      className="h-11 w-auto object-contain opacity-95 transition-opacity duration-300 group-hover:opacity-100"
                    />
                  ) : null}
                  <span className="flex flex-col leading-none">
                    <span className="font-display text-3xl font-black uppercase tracking-[-0.03em] text-cream">
                      {BRAND.name}
                    </span>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.42em] text-cream/45">
                      {BRAND.suffix}
                    </span>
                  </span>
                </Link>

                {/* ------------------------------------------ contact details */}
                <address className="mt-6 max-w-xs space-y-3 text-sm not-italic leading-relaxed text-cream/50">
                  <span className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-terracotta/80" aria-hidden="true" />
                    <span>
                      {ADDRESS_LINES.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </span>
                  </span>

                  <a
                    href={CONTACT.phoneHref}
                    className="flex items-center gap-2.5 transition-colors hover:text-cream"
                  >
                    <Phone className="size-4 shrink-0 text-terracotta/80" aria-hidden="true" />
                    {CONTACT.phone}
                  </a>

                  <a
                    href={CONTACT.emailHref}
                    className="flex items-start gap-2.5 break-all transition-colors hover:text-cream"
                  >
                    <Mail className="mt-0.5 size-4 shrink-0 text-terracotta/80" aria-hidden="true" />
                    {CONTACT.email}
                  </a>
                </address>

                <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-cream/35">
                  {OPENING_HOURS.label}
                </p>

                {/* ------------------------------------------------- socials */}
                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  {SOCIALS.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${social.label} - ${social.handle}`}
                      aria-label={`${social.label}: ${social.handle}`}
                      className="group flex size-10 items-center justify-center rounded-full bg-cream/10 text-cream/70 transition-colors duration-300 hover:bg-terracotta hover:text-cream"
                    >
                      {createElement(social.icon, { className: "size-[18px]", "aria-hidden": true })}
                    </a>
                  ))}
                </div>
              </div>

              {FOOTER_COLUMNS.map((col) => (
                <div key={col.title}>
                  <h3 className="text-eyebrow text-terracotta">{col.title}</h3>
                  <ul className="mt-5 space-y-3">
                    {col.links.map((link) => {
                        const icon = linkIcon(link.href);
                        return (
                          <li key={link.label}>
                            <Link
                              href={link.href}
                              className="group inline-flex items-center gap-2 text-sm text-cream/60 transition-colors duration-300 hover:text-cream"
                            >
                              {icon && (
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-cream/10 text-terracotta/90 transition-colors duration-300 group-hover:bg-terracotta group-hover:text-cream">
                                  {createElement(icon, { className: "size-3", "aria-hidden": true })}
                                </span>
                              )}
                              {link.label}
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          </RevealItem>

          {/* ------------------------------------------------------- baseline */}
          <RevealItem>
            <div className="mt-14 flex flex-col-reverse gap-5 border-t border-cream/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-cream/35">
                © {new Date().getFullYear()} {SITE.legalName}. {BRAND.tagline}{" "}
                {LOCATION.label}.
              </p>
              <div className="flex flex-wrap gap-6">
                {LEGALS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="text-xs text-cream/45 transition-colors hover:text-cream"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </footer>
  );
}
