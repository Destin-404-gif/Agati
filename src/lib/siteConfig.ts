/**
 * Single source of truth for every contact detail, social account, location and
 * currency the site publishes.
 *
 * Nothing below may be duplicated as a literal anywhere else - the header, the
 * footer, the contact page, the checkout flow, the SEO metadata and the JSON-LD
 * all import from this file, so a number changes here and nowhere else.
 *
 * This module is imported by both server and client components, so it must stay
 * free of "use client", Node built-ins and any database access.
 */

import type { LucideIcon } from "lucide-react";
import { AtSign, Camera, Mail, MessageCircle } from "lucide-react";

/* ------------------------------------------------------------------ contact */

/** How the shop is reached. Everything else on the site derives from this. */
export const CONTACT = {
  /** As printed on signs and read out over the phone. */
  phone: "0784088929",
  /** E.164, for tel: links. */
  phoneHref: "tel:+250784088929",
  /** E.164 without separators - wa.me deep links need this exact form. */
  whatsapp: "250784088929",
  email: "agatiwoodworks@gmail.com",
  emailHref: "mailto:agatiwoodworks@gmail.com",
} as const;

export const whatsappLink = (message?: string): string =>
  `https://wa.me/${CONTACT.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/* ------------------------------------------------------------------- social */

export type SocialLink = {
  /** Visible label - also the accessible name for the icon. */
  label: string;
  /** Handle shown next to the icon, empty where the URL is the whole label. */
  handle: string;
  href: string;
  icon: LucideIcon;
};

export const SOCIALS: SocialLink[] = [
  {
    label: "WhatsApp",
    handle: CONTACT.phone,
    href: whatsappLink(),
    icon: MessageCircle,
  },
  {
    label: "Instagram",
    handle: "@tuyishimeee",
    href: "https://instagram.com/tuyishimeee",
    icon: Camera,
  },
  {
    label: "X",
    handle: "@AgatiWoodworks",
    href: "https://x.com/AgatiWoodworks",
    icon: AtSign,
  },
  {
    label: "Email",
    handle: CONTACT.email,
    href: CONTACT.emailHref,
    icon: Mail,
  },
];

/* ----------------------------------------------------------------- location */

export const LOCATION = {
  /** Town / region, used in metadata and JSON-LD. */
  city: "Musanze",
  country: "Rwanda",
  /** Shopfront address, used in the contact page and JSON-LD. */
  street: "Bukinanyana, Cyuve",
  area: "Musanze",
  /** `city, country` - the form most screens and search engines want. */
  label: "Musanze, Rwanda",
  /** What we call the place in running copy. */
  short: "Musanze",
} as const;

export const ADDRESS_LINES: string[] = [
  LOCATION.street,
  `${LOCATION.area}, ${LOCATION.country}`,
];

/** Full postal address as one line, for JSON-LD and <address>. */
export const FULL_ADDRESS = `${LOCATION.street}, ${LOCATION.area}, ${LOCATION.country}`;

/* ------------------------------------------------------------------ opening */

export const OPENING_HOURS = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  /** schema.org format */
  schema: "Mo-Sa 08:00-18:00",
  label: "Monday - Saturday, 08:00 - 18:00",
} as const;

/* ----------------------------------------------------------------- currency */

/**
 * Prices are held in RWF. `amount` is the raw figure from the database; nothing
 * is converted - the database column is the price in Rwandan francs.
 */
export const CURRENCY = {
  code: "RWF",
  /** en-RW renders `RWF 25,000`, which is how prices are quoted locally. */
  locale: "en-RW",
} as const;

/* ------------------------------------------------------------------ payment */

/**
 * The only payment method on offer. Online payment is deliberately absent: the
 * order is confirmed by the workshop over WhatsApp and paid on delivery.
 */
export const PAYMENT_METHODS = [
  { id: "pay_on_delivery", label: "Pay on delivery - confirm via WhatsApp" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = "pay_on_delivery";

/* ------------------------------------------------------------------ branding */

export const SITE = {
  name: "Agati Wood Works",
  legalName: "Agati Wood Works",
  shortName: "Agati",
  /** Bare origin - no trailing slash - for canonical URLs and JSON-LD. */
  url: "https://agatiwoodworks.com",
  tagline: "Solid hardwood furniture and custom woodworks, made in Musanze, Rwanda.",
  description:
    "Solid hardwood furniture, custom builds, millwork and timber supply. Steam-bent, hand-cut and finished in hardwax oil in our Musanze workshop, Rwanda.",
  founded: "2019",
} as const;

/* --------------------------------------------------------------------- JSON */

/**
 * schema.org LocalBusiness payload. Prices, the address, the phone and the
 * social profiles all come from the constants above, so the structured data can
 * never drift from what a visitor actually sees on the page.
 */
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FurnitureStore",
    name: SITE.name,
    legalName: SITE.legalName,
    description: SITE.description,
    url: SITE.url,
    telephone: CONTACT.phoneHref.replace("tel:", ""),
    email: CONTACT.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: LOCATION.street,
      addressLocality: LOCATION.area,
      addressRegion: LOCATION.area,
      addressCountry: "RW",
    },
    areaServed: LOCATION.label,
    sameAs: SOCIALS.filter((s) => s.href.startsWith("http")).map((s) => s.href),
    openingHours: OPENING_HOURS.schema,
    priceRange: "$$",
    currenciesAccepted: CURRENCY.code,
    foundingDate: SITE.founded,
  };
}

/* ------------------------------------------------------- order confirmation */

/** One line of the WhatsApp message sent after an order is placed. */
export type WhatsAppOrderLine = {
  name: string;
  variant_name?: string | null;
  quantity: number;
  line_total: string;
};

/**
 * The prefilled message on the confirmation page's "Chat on WhatsApp" button:
 * order number, items, quantities, total, and who and where it is going.
 */
export function whatsappOrderMessage(order: {
  order_number: string;
  full_name: string;
  phone: string;
  location: string;
  items: WhatsAppOrderLine[];
  total: string;
}): string {
  const lines = [
    `Hello Agati Wood Works, I have just placed order ${order.order_number}.`,
    "",
    `Name: ${order.full_name}`,
    `Phone: ${order.phone}`,
    `Delivery: ${order.location}`,
    "",
    ...order.items.map(
      (item) =>
        `• ${item.name}${item.variant_name ? ` (${item.variant_name})` : ""} ×${item.quantity} - RWF ${item.line_total}`,
    ),
    "",
    `Total: RWF ${order.total}`,
    "",
    "Please confirm the delivery date and payment on delivery. Thank you.",
  ];
  return lines.join("\n");
}