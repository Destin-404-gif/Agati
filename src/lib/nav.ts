/** Single source of truth for the header nav and the footer link columns. */

export const BRAND = {
  /** Full wordmark - stacked, so it can sit on two lines in a narrow header. */
  name: "AGATI",
  suffix: "WOOD WORKS",
  tagline: "Solid hardwood. Custom furniture. Since 2019.",
} as const;

export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Furniture", href: "/furniture" },
  { label: "Custom Furniture", href: "/custom-furniture" },
  { label: "Our Projects", href: "/projects" },
  { label: "Gallery", href: "/gallery" },
  { label: "Services", href: "/services" },
  { label: "Contact Us", href: "/contact" },
];

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: "Furniture",
    links: [
      { label: "Armchairs", href: "/furniture?category=armchairs" },
      { label: "Chairs", href: "/furniture?category=chairs" },
      { label: "Sofas", href: "/furniture?category=sofas" },
      { label: "Custom Furniture", href: "/custom-furniture" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Projects", href: "/projects" },
      { label: "Gallery", href: "/gallery" },
      { label: "Services", href: "/services" },
    ],
  },
  {
    title: "Work with us",
    links: [
      { label: "Get a Quote", href: "/contact#quote" },
      { label: "Custom Orders", href: "/custom-furniture#process" },
      { label: "Timber Supply", href: "/services#timber" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

export const LEGALS: NavLink[] = [
  { label: "Privacy", href: "/about" },
  { label: "Terms", href: "/about" },
  { label: "Cookies", href: "/about" },
];
