/**
 * Single source of truth for the storefront navigation.
 *
 * The navbar triggers, the mega-menu, the mobile drawer, the shop pages and
 * the search suggestions all read from `CATEGORIES` below - nothing here
 * hardcodes a category into JSX, so adding a category is a data edit and
 * nothing more.
 *
 * Every category carries a Lucide icon so the whole site speaks one visual
 * language: the same `<Sofa>` above "Living Room" in the navbar pill, the
 * mega-menu tile, the mobile drawer, the search sidebar and the shop pages.
 * The icons are stored as component references rather than name tokens so
 * consumers render `<category.icon />` directly (they are RSC-safe).
 *
 * This is deliberately a plain module rather than a database read: the
 * PostgreSQL `categories` table only holds three coarse buckets (Armchairs,
 * Chairs, Sofas) and has no subcategory concept, whereas the storefront needs a
 * two-level taxonomy. When a real taxonomy table lands, swap `CATEGORIES` for a
 * fetch - the shape below is already the one a `categories` / `subcategories`
 * join would return, and every helper in this file keeps working unchanged.
 *
 * SLUG RULES
 *  - kebab-case, stable, and never reused for a different meaning. A slug
 *    appears in the URL and in search results, so renaming one breaks links.
 *  - the 10 category slugs are also the `?category=` values on /search, so
 *    they must match between this file and the database when the taxonomy is
 *    migrated.
 *  - subcategory slugs are scoped to their category (they only ever appear as
 *    `/shop/[category]/[slug]`), so "armchairs" may safely repeat across rooms.
 */

import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Armchair,
  Baby,
  Bed,
  BedDouble,
  BedSingle,
  BookOpen,
  Boxes,
  Briefcase,
  ChefHat,
  Container,
  Cuboid,
  Lamp,
  LampDesk,
  Layers,
  Library,
  Monitor,
  Package,
  PanelLeft,
  PanelTop,
  PencilRuler,
  Rows3,
  Ruler,
  Shapes,
  Sofa,
  Sparkles,
  SquareStack,
  Table,
  Table2,
  TentTree,
  TreePine,
  Trees,
  Tv,
  UtensilsCrossed,
} from "lucide-react";

export type CatLink = {
  name: string;
  slug: string;
  /** One-line description shown under the link in the mega-menu, drawer and search. */
  description: string;
  icon: LucideIcon;
};

export type CategoryGroup = {
  title: string;
  items: CatLink[];
};

export type FeaturedCard = {
  title: string;
  description: string;
  ctaLabel: string;
};

export type Category = {
  name: string;
  slug: string;
  icon: LucideIcon;
  /** Short line used for SEO copy and the mega-menu tile. */
  blurb: string;
  /** Hero card on the left of the mega-menu panel. */
  featured: FeaturedCard;
  /** Two link groups; each item is a shop link with its own icon. */
  groups: CategoryGroup[];
};

/**
 * The ten flagship categories. The first six render inline on large screens
 * (see `PRIMARY_SLUGS`); the remaining four live behind the "More" trigger
 * until 2xl, where the full row of ten fits.
 */
export const CATEGORIES: Category[] = [
  {
    name: "Living Room",
    slug: "living-room",
    icon: Sofa,
    blurb: "Sofas, armchairs and coffee tables - the pieces rooms are built around.",
    featured: {
      title: "The room the house lives in",
      description: "Low, deep sofas and tables that hold a mug and a book. Built to be lived on.",
      ctaLabel: "Shop living room",
    },
    groups: [
      {
        title: "Shop by type",
        items: [
          { name: "Sofas", slug: "sofas", description: "Three-seaters cut low and deep for long evenings.", icon: Sofa },
          { name: "Sectional & L-shaped", slug: "sectional-l-shaped-couches", description: "Wraps a corner, seats the whole household.", icon: Armchair },
          { name: "Armchairs", slug: "armchairs", description: "Reading chairs built to be sat in for hours.", icon: Armchair },
          { name: "Coffee tables", slug: "coffee-tables", description: "The centre of gravity for the whole room.", icon: Table },
        ],
      },
      {
        title: "Storage & display",
        items: [
          { name: "TV stands", slug: "tv-stands-units", description: "Cable-savvy storage that tucks the screen away.", icon: Tv },
          { name: "Side & console tables", slug: "side-console-tables", description: "Slender surfaces for hallways and sofa arms.", icon: PanelLeft },
          { name: "Display cabinets", slug: "display-cabinets", description: "Glass-fronted cases for the things you keep.", icon: SquareStack },
        ],
      },
    ],
  },
  {
    name: "Bedroom",
    slug: "bedroom",
    icon: BedDouble,
    blurb: "Beds, wardrobes and dressing tables in solid oak, walnut and ash.",
    featured: {
      title: "Sleep is the project",
      description: "Platform beds, wardrobes and dressing tables in quiet, close-grained timber.",
      ctaLabel: "Shop bedroom",
    },
    groups: [
      {
        title: "Sleep",
        items: [
          { name: "Beds & frames", slug: "beds-bed-frames", description: "Platform, low or sleigh - cut as one piece.", icon: BedDouble },
          { name: "Headboards", slug: "headboards", description: "Padded or plain-sawn, sized to rest against.", icon: PanelTop },
          { name: "Mirrors", slug: "mirrors", description: "Frame-and-panel mirrors that widen a room.", icon: Sparkles },
          { name: "Wardrobes", slug: "wardrobes", description: "Floor-to-ceiling storage with an interior fit-out.", icon: Archive },
        ],
      },
      {
        title: "Bedside & storage",
        items: [
          { name: "Bedside tables", slug: "bedside-tables", description: "Small shelves for a book, a clock and a cup.", icon: Lamp },
          { name: "Dressing tables", slug: "dressing-tables", description: "Vanity height, with drawers for the daily kit.", icon: LampDesk },
          { name: "Chest of drawers", slug: "chest-of-drawers", description: "Four or six runners, each doing its weight.", icon: Container },
          { name: "Benches", slug: "bedroom-benches", description: "A seat at the foot of the bed and a shelf below.", icon: PanelLeft },
        ],
      },
    ],
  },
  {
    name: "Office",
    slug: "office",
    icon: Briefcase,
    blurb: "Desks, chairs and storage cut for long hours and heavier timber.",
    featured: {
      title: "Built for the workday",
      description: "Solid-top desks and warmed chairs that carry eight-hour days without a groan.",
      ctaLabel: "Shop office",
    },
    groups: [
      {
        title: "Workspace",
        items: [
          { name: "Office desks", slug: "office-desks", description: "Solid-top desks wired for real work.", icon: Table },
          { name: "Executive desks", slug: "executive-desks", description: "Command-centre desks in walnut and oak.", icon: Rows3 },
          { name: "Computer desks", slug: "computer-desks", description: "Cable channels and keyboard trays built in.", icon: Monitor },
          { name: "Office chairs", slug: "office-chairs", description: "Ergonomic, upholstered, on quiet casters.", icon: Armchair },
        ],
      },
      {
        title: "Meetings & reception",
        items: [
          { name: "Reception desks", slug: "reception-desks", description: "The first impression, built to last decades.", icon: PanelTop },
          { name: "Meeting tables", slug: "meeting-tables", description: "Rounds, boats and racetracks for the boardroom.", icon: Table2 },
          { name: "Conference chairs", slug: "conference-chairs", description: "Stackable and upholstered for long sits.", icon: Shapes },
          { name: "Filing cabinets", slug: "filing-cabinets", description: "Lateral, lockable, feather-smooth drawers.", icon: Boxes },
        ],
      },
    ],
  },
  {
    name: "Dining Room",
    slug: "dining-room",
    icon: UtensilsCrossed,
    blurb: "Tables and chairs sized to your room, not to a showroom.",
    featured: {
      title: "Gather around the board",
      description: "Tables that seat four or fourteen, cut from one slab and finished hardwax.",
      ctaLabel: "Shop dining room",
    },
    groups: [
      {
        title: "Dining",
        items: [
          { name: "Dining tables", slug: "dining-tables", description: "Round, refectory or extendable to seat the guests.", icon: Table2 },
          { name: "Dining chairs", slug: "dining-chairs", description: "Upholstered or plain-sawn, matched to your table.", icon: Armchair },
          { name: "Dining sets", slug: "dining-sets", description: "Table and six, drawn as one design.", icon: Table },
        ],
      },
      {
        title: "Serving & bar",
        items: [
          { name: "Sideboards & buffets", slug: "sideboards-buffets", description: "Low storage for the serving line.", icon: PanelLeft },
          { name: "Bar tables", slug: "bar-tables", description: "Counter-height tops for the short and tall.", icon: Table },
          { name: "Bar stools", slug: "bar-stools", description: "Counter-height, foot-railed, warm to the touch.", icon: Shapes },
        ],
      },
    ],
  },
  {
    name: "Kitchen",
    slug: "kitchen",
    icon: ChefHat,
    blurb: "Cabinets, islands and pantry storage with integrated soft-close hardware.",
    featured: {
      title: "Where the day starts",
      description: "Islands, cabinets and pantry storage with soft-close hardware that stays quiet.",
      ctaLabel: "Shop kitchen",
    },
    groups: [
      {
        title: "Cabinetry",
        items: [
          { name: "Kitchen cabinets", slug: "kitchen-cabinets", description: "Cut from one timber run, fitted with soft-close.", icon: ChefHat },
          { name: "Islands", slug: "kitchen-islands", description: "Prep, sit and eat at the one solid block.", icon: Cuboid },
          { name: "Pantry storage", slug: "pantry-storage", description: "Everything reachable, nothing wasted.", icon: Boxes },
          { name: "Shelves", slug: "kitchen-shelves", description: "Open shelving for the daily reach.", icon: Layers },
        ],
      },
      {
        title: "Eating areas",
        items: [
          { name: "Breakfast tables", slug: "breakfast-tables", description: "Two or four seats for the first cup.", icon: Table },
          { name: "Kitchen stools", slug: "kitchen-stools", description: "Counter-height seats for the island.", icon: Shapes },
        ],
      },
    ],
  },
  {
    name: "Outdoor",
    slug: "outdoor",
    icon: TreePine,
    blurb: "Teak and iroko for the garden - left to silver, or oiled to hold colour.",
    featured: {
      title: "Built for the weather",
      description: "Teak, iroko and oiled oak that shrug off rain and silver in the sun.",
      ctaLabel: "Shop outdoor",
    },
    groups: [
      {
        title: "Dining & lounging",
        items: [
          { name: "Outdoor tables", slug: "outdoor-tables", description: "Weather-proof tops that shrug off the rain.", icon: Table2 },
          { name: "Outdoor chairs", slug: "outdoor-chairs", description: "Stackable seating for the deck and lawn.", icon: Armchair },
          { name: "Outdoor sofas", slug: "outdoor-sofas", description: "Modular lounging made for all-day sun.", icon: Sofa },
          { name: "Wooden loungers", slug: "wooden-loungers", description: "Recline beside the pool or under the pines.", icon: TentTree },
        ],
      },
      {
        title: "Garden & patio",
        items: [
          { name: "Garden benches", slug: "garden-benches", description: "A sweep of solid timber for the quiet corner.", icon: PanelLeft },
          { name: "Patio furniture", slug: "patio-furniture", description: "Full sets, built to stay outdoors all year.", icon: Trees },
          { name: "Picnic tables", slug: "picnic-tables", description: "Built for the top of a hill, not a level floor.", icon: Table },
          { name: "Outdoor storage", slug: "outdoor-storage", description: "Sealed boxes for the cushions and tools.", icon: SquareStack },
        ],
      },
    ],
  },

  /* ---- below this line: behind the "More" pill until 2xl ---- */
  {
    name: "Chairs & Seating",
    slug: "chairs-seating",
    icon: Armchair,
    blurb: "Every chair the workshop makes - from wing-backed readers to bar stools.",
    featured: {
      title: "Seating in every key",
      description: "From wing-backed readers to counter-height bar stools - every chair, one at a time.",
      ctaLabel: "Shop chairs & seating",
    },
    groups: [
      {
        title: "Everyday seating",
        items: [
          { name: "Armchairs", slug: "armchairs", description: "Reading chairs built to be sat in for hours.", icon: Armchair },
          { name: "Dining chairs", slug: "dining-chairs", description: "Matched to your table, comfortable all evening.", icon: Armchair },
          { name: "Reading chairs", slug: "reading-chairs", description: "Wing-backed seats for the corner by the window.", icon: BookOpen },
          { name: "Benches", slug: "benches", description: "Slim oak seats for halls and mudrooms.", icon: PanelLeft },
        ],
      },
      {
        title: "Work & bar seating",
        items: [
          { name: "Office chairs", slug: "office-chairs", description: "Ergonomic, upholstered, on quiet casters.", icon: Armchair },
          { name: "Conference chairs", slug: "conference-chairs", description: "Stackable and upholstered for long sits.", icon: Shapes },
          { name: "Bar stools", slug: "bar-stools", description: "Counter-height, foot-railed, warm to the touch.", icon: Rows3 },
          { name: "Lounge chairs", slug: "lounge-chairs", description: "Low-slung seats for after dinner.", icon: Sofa },
        ],
      },
    ],
  },
  {
    name: "Storage & Shelving",
    slug: "storage-shelving",
    icon: Library,
    blurb: "Cabinets, bookcases and drawer runs that earn their floor space.",
    featured: {
      title: "Every shelf in its place",
      description: "Cabinets, bookcases and drawer runs that earn their floor space twice over.",
      ctaLabel: "Shop storage",
    },
    groups: [
      {
        title: "Cabinets",
        items: [
          { name: "Cabinets", slug: "cabinets", description: "Closed fronts, slow-hinged, timber inside and out.", icon: Archive },
          { name: "Wardrobes", slug: "wardrobes", description: "Floor-to-ceiling storage with an interior fit-out.", icon: SquareStack },
          { name: "Chest of drawers", slug: "chest-of-drawers", description: "Four or six runners, each doing its weight.", icon: Container },
          { name: "Filing cabinets", slug: "filing-cabinets", description: "Lateral, lockable, feather-smooth drawers.", icon: Boxes },
        ],
      },
      {
        title: "Shelving",
        items: [
          { name: "Bookshelves", slug: "bookshelves", description: "Runs sized to the book, not to the box.", icon: BookOpen },
          { name: "Shelving units", slug: "shelving-units", description: "Open frames for records, plants and the everyday.", icon: Rows3 },
          { name: "Storage benches", slug: "storage-benches", description: "A seat with stowage hidden beneath the lid.", icon: PanelLeft },
          { name: "Display cabinets", slug: "display-cabinets", description: "Glass-fronted cases for the things you keep.", icon: Sparkles },
        ],
      },
    ],
  },
  {
    name: "Kids & Nursery",
    slug: "kids-nursery",
    icon: Baby,
    blurb: "Bunk beds, study desks and toy storage, built to be climbed on.",
    featured: {
      title: "Built to be climbed on",
      description: "Bunk beds, study desks and toy storage sized for the small and the fearless.",
      ctaLabel: "Shop kids & nursery",
    },
    groups: [
      {
        title: "Sleep & study",
        items: [
          { name: "Children's beds", slug: "childrens-beds", description: "Low, rounded and built to be jumped on.", icon: Bed },
          { name: "Bunk beds", slug: "bunk-beds", description: "Two storeys of sleep, one always a ladder away.", icon: BedSingle },
          { name: "Study desks", slug: "study-desks", description: "A desk that grows with the years of homework.", icon: Monitor },
          { name: "Children's chairs", slug: "childrens-chairs", description: "Small-scale seats that survive the daily climb.", icon: Armchair },
        ],
      },
      {
        title: "Storage",
        items: [
          { name: "Toy storage", slug: "toy-storage", description: "Soft-close boxes, low to the ground.", icon: Package },
          { name: "Bookshelves", slug: "bookshelves", description: "Runs sized to the picture book, reachable early.", icon: BookOpen },
        ],
      },
    ],
  },
  {
    name: "Custom Furniture",
    slug: "custom-furniture",
    icon: Ruler,
    blurb: "Made-to-measure in any timber, drawn before it is cut.",
    featured: {
      title: "Drawn before it is cut",
      description: "Any piece, any timber, any dimension. The workshop draws it, quotes it, then builds it.",
      ctaLabel: "Start a custom piece",
    },
    groups: [
      {
        title: "Made for you",
        items: [
          { name: "Custom beds", slug: "custom-beds", description: "Sized to the room and the mattress you already own.", icon: BedDouble },
          { name: "Custom wardrobes", slug: "custom-wardrobes", description: "Built around how you actually pack things.", icon: Archive },
          { name: "Custom tables", slug: "custom-tables", description: "Any length, any top, any timber the workshop holds.", icon: Table2 },
          { name: "Custom desks", slug: "custom-desks", description: "Cut to the bay, the cable run and the way you work.", icon: Monitor },
        ],
      },
      {
        title: "More",
        items: [
          { name: "Custom cabinets", slug: "custom-cabinets", description: "Cases that fit the wall they have to live in.", icon: Boxes },
          { name: "Custom sofas", slug: "custom-sofas", description: "Depth, height and cushion fill, all your call.", icon: Sofa },
          { name: "Made-to-measure furniture", slug: "made-to-measure-furniture", description: "Any piece, any dimension - drawn before it is cut.", icon: PencilRuler },
        ],
      },
    ],
  },
];

/**
 * Categories shown inline on the navbar from lg up. The rest live behind the
 * "More" pill - ten links will not fit one comfortable row at xl widths, so the
 * full ten render inline at 2xl and "More" fills the gap in between.
 */
export const PRIMARY_SLUGS = [
  "living-room",
  "bedroom",
  "office",
  "dining-room",
  "kitchen",
  "outdoor",
] as const;

/* ------------------------------------------------------------------ helpers */

export const categoryHref = (category: string) => `/shop/${category}`;
export const subcategoryHref = (category: string, sub: string) =>
  `/shop/${category}/${sub}`;

/** All shop links across a category's groups, in taxonomy order. */
export const categoryItems = (category: Category): CatLink[] =>
  category.groups.flatMap((group) => group.items);

export const primaryCategories = (): Category[] =>
  CATEGORIES.filter((c) => (PRIMARY_SLUGS as readonly string[]).includes(c.slug));

/** The categories behind the "More" button, in taxonomy order. */
export const moreCategories = (): Category[] =>
  CATEGORIES.filter((c) => !(PRIMARY_SLUGS as readonly string[]).includes(c.slug));

export const findCategory = (slug: string): Category | undefined =>
  CATEGORIES.find((c) => c.slug === slug);

export const findSubcategory = (category: string, sub: string): CatLink | undefined =>
  findCategory(category)?.groups
    .flatMap((g) => g.items)
    .find((i) => i.slug === sub);

export const isCategorySlug = (slug: string) =>
  CATEGORIES.some((c) => c.slug === slug);

/** The icon for a category slug (undefined for unknown slugs). */
export const categoryIcon = (slug: string): LucideIcon | undefined =>
  findCategory(slug)?.icon;

/**
 * Icon for the three coarse database categories (Armchairs / Chairs / Sofas).
 * The storefront taxonomy above has no direct column in PostgreSQL yet, so the
 * homepage bento grid and footer keep their own slug → icon map.
 */
const DB_ICON_BY_SLUG: Record<string, LucideIcon> = {
  armchairs: Armchair,
  chairs: Armchair,
  sofas: Sofa,
};

export const dbCategoryIcon = (slug: string): LucideIcon | undefined =>
  DB_ICON_BY_SLUG[slug];

/** Every subcategory label, for the search fallback list. */
export const subcategoryNames = (): string[] =>
  CATEGORIES.flatMap((c) => categoryItems(c).map((i) => i.name));

/* -------------------------------------------------------------- nav search */

export type NavMatch = {
  kind: "category" | "subcategory";
  name: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  href: string;
};

/**
 * Match a free-text term against the navigation tree.
 *
 * Ranks exact name matches first, then prefix matches, then substring matches,
 * so typing "desk" surfaces "Office desks" ahead of "Computer desks" - or
 * "Custom desks". Pure string work - no database round-trip, which is what
 * keeps the suggestions dropdown instant.
 */
export function searchNav(term: string, limit = 8): NavMatch[] {
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return [];

  const scored: { match: NavMatch; score: number }[] = [];

  const push = (match: NavMatch, haystack: string) => {
    if (haystack === needle) scored.push({ match, score: 0 });
    else if (haystack.startsWith(needle)) scored.push({ match, score: 1 });
    else if (haystack.split(/\s+/).some((w) => w.startsWith(needle)))
      scored.push({ match, score: 2 });
    else if (haystack.includes(needle)) scored.push({ match, score: 3 });
  };

  for (const category of CATEGORIES) {
    push(
      {
        kind: "category",
        name: category.name,
        slug: category.slug,
        categoryName: category.name,
        categorySlug: category.slug,
        href: categoryHref(category.slug),
      },
      category.name.toLowerCase(),
    );

    for (const item of categoryItems(category)) {
      push(
        {
          kind: "subcategory",
          name: item.name,
          slug: item.slug,
          categoryName: category.name,
          categorySlug: category.slug,
          href: subcategoryHref(category.slug, item.slug),
        },
        item.name.toLowerCase(),
      );
    }
  }

  return scored
    .sort((a, b) => a.score - b.score || a.match.name.localeCompare(b.match.name))
    .slice(0, limit)
    .map((s) => s.match);
}
