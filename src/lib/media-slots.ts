/**
 * The image registry.
 *
 * Every picture on the public site is addressed by a stable slot key. The
 * database row holds the current file; this module holds only the *metadata*
 * about each slot (its name, which panel it belongs to, its default alt text),
 * so the admin UI can render a labelled grid and the storefront can render a
 * sensible fallback alt.
 *
 * Nothing here contains an image path. That lives in `media_slots` and nowhere
 * else - that is the whole point: swapping a picture is a row update, and the
 * next request already shows it.
 *
 * This module is deliberately free of any database import so client components
 * can use the slot helpers without dragging `pg` into the browser bundle. The
 * query side lives in `media.ts`.
 */

import type { ImageVariant } from "./image-variants";

/** `vector` slots additionally accept an SVG upload (the logo, the favicon). */
export type MediaKind = "photo" | "vector";

export interface MediaSlotDef {
  key: string;
  label: string;
  group: string;
  kind: MediaKind;
  /** Used when the admin has not written alt text for the slot. */
  alt: string;
}

export interface MediaAsset {
  url: string;
  thumbUrl: string | null;
  /** The 400 / 1200 / 2560 / 3840 family; any of these may be null on old rows. */
  variant400Url: string | null;
  variant1200Url: string | null;
  variant2560Url: string | null;
  variant3840Url: string | null;
  /** The same family as `{ width, url }`, ascending, for `srcSet` building. */
  variants: ImageVariant[];
  alt: string;
  width: number | null;
  height: number | null;
  originalWidth: number | null;
  originalHeight: number | null;
  bytes: number | null;
}

/** A slot definition paired with whatever the database currently holds for it. */
export interface MediaSlotState {
  def: MediaSlotDef;
  current: MediaAsset | null;
}

/* ------------------------------------------------------------------ slots */

/** Repeating slot families, so a new slide or service is one line of config. */
export const HERO_SLIDE_COUNT = 5;
export const SERVICE_COUNT = 6;
export const PROJECT_COUNT = 6;
export const GALLERY_COUNT = 10;

/**
 * Category panels are addressed by slug rather than declared one by one, so a
 * category added to `navigation.ts` gets a slot automatically.
 */
export const categorySlot = (slug: string): string => `category_${slug}`;
export const heroSlideSlot = (index: number): string => `hero_slide_${index + 1}`;
export const serviceSlot = (index: number): string => `service_${index + 1}`;
export const projectSlot = (index: number): string => `project_${index + 1}`;
export const gallerySlot = (index: number): string => `gallery_${index + 1}`;
export const pageHeroSlot = (page: string): string => `page_hero_${page}`;

/** Pages that open on a banner, keyed by the route segment that renders it. */
export const PAGE_HERO_PAGES = [
  "about",
  "furniture",
  "custom-furniture",
  "projects",
  "gallery",
  "services",
  "contact",
] as const;

const HERO_ALTS = [
  "A solid white oak dining table with hand-cut joinery",
  "Hardwood boards stacked on air-drying racks",
  "Bent ash chair backs fresh from the steam bender",
  "Hand-cut dovetails in solid white oak",
  "Walnut crotch selected and bookmatched",
];

const SERVICE_TITLES = [
  "Custom builds",
  "Millwork",
  "Timber supply",
  "Restoration",
  "Finishing",
  "Trade work",
];

const PROJECT_TITLES = [
  "Ashfield library",
  "Musanze lodge",
  "Hotel dining room",
  "Boardroom table",
  "Garden studio",
  "Cottage kitchen",
];

const GALLERY_TITLES = [
  "Saw floor",
  "Air-drying racks",
  "Dovetail joint",
  "Steam bending",
  "Hand plane",
  "Bookmatched walnut",
  "Tenon and mortise",
  "Chisel work",
  "Bench joinery",
  "Finished dining table",
];

function photo(
  key: string,
  label: string,
  group: string,
  alt: string,
): MediaSlotDef {
  return { key, label, group, kind: "photo", alt };
}

function vector(
  key: string,
  label: string,
  group: string,
  alt: string,
): MediaSlotDef {
  return { key, label, group, kind: "vector", alt };
}

function buildSlots(): MediaSlotDef[] {
  const slots: MediaSlotDef[] = [
    // The mark is a vector slot: an SVG logo stays crisp on every display, so
    // these two are the only slots that accept one.
    vector("logo", "Logo", "Branding", "Agati Wood Works"),
    vector("favicon", "Favicon", "Branding", "Agati Wood Works"),
  ];

  for (let i = 0; i < HERO_SLIDE_COUNT; i += 1) {
    slots.push(
      photo(
        heroSlideSlot(i),
        `Homepage hero - slide ${i + 1}`,
        "Homepage hero",
        HERO_ALTS[i],
      ),
    );
  }

  slots.push(
    photo(
      "intro_workshop",
      "Homepage - workshop teaser",
      "Homepage",
      "A maker cutting a length of oak on the workshop saw floor",
    ),
    photo(
      "featured_collection",
      "Homepage - featured commission",
      "Homepage",
      "A full-wall oak library with a reading chair in a panelled room",
    ),
    photo(
      "about_workshop",
      "About - the workshop floor",
      "Editorial",
      "The Agati workshop floor in morning light",
    ),
    photo(
      "custom_furniture_timber_racks",
      "Custom furniture - timber racks",
      "Editorial",
      "Dried hardwood stacked on air-drying racks",
    ),
    photo("footer_background", "Footer background", "Branding", ""),
    photo("og_image", "Social share image", "Branding", "Agati Wood Works"),
  );

  for (const page of PAGE_HERO_PAGES) {
    slots.push(
      photo(
        pageHeroSlot(page),
        `Banner - /${page}`,
        "Page banners",
        `${page} page banner`,
      ),
    );
  }

  for (let i = 0; i < SERVICE_COUNT; i += 1) {
    slots.push(
      photo(
        serviceSlot(i),
        `Service - ${SERVICE_TITLES[i]}`,
        "Services",
        SERVICE_TITLES[i],
      ),
    );
  }

  for (let i = 0; i < PROJECT_COUNT; i += 1) {
    slots.push(
      photo(
        projectSlot(i),
        `Project - ${PROJECT_TITLES[i]}`,
        "Projects",
        PROJECT_TITLES[i],
      ),
    );
  }

  for (let i = 0; i < GALLERY_COUNT; i += 1) {
    slots.push(
      photo(
        gallerySlot(i),
        `Gallery - ${GALLERY_TITLES[i]}`,
        "Gallery",
        GALLERY_TITLES[i],
      ),
    );
  }

  return slots;
}

/** Every declared slot, in the order the admin grid should show them. */
export const MEDIA_SLOTS: MediaSlotDef[] = buildSlots();

const SLOT_INDEX = new Map(MEDIA_SLOTS.map((s) => [s.key, s]));

export function slotDef(key: string): MediaSlotDef | undefined {
  return SLOT_INDEX.get(key);
}

/**
 * Category panels are open-ended, so they are not part of `MEDIA_SLOTS`; this
 * builds the definition on demand for the admin grid.
 */
export function categorySlotDef(slug: string, label: string): MediaSlotDef {
  return {
    key: categorySlot(slug),
    label: `Category panel - ${label}`,
    group: "Categories",
    kind: "photo",
    alt: `${label} furniture`,
  };
}

/**
 * Every slot the admin grid should offer: the declared registry plus one panel
 * per category in the navigation. Sorted so groups render together.
 */
export function allMediaSlots(
  categories: readonly { slug: string; name: string }[],
): MediaSlotDef[] {
  const extra = categories.map((c) => categorySlotDef(c.slug, c.name));
  return [...MEDIA_SLOTS, ...extra];
}