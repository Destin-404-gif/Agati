/**
 * Admin navigation. Each entry declares the permission needed to see it, so the
 * sidebar simply filters on the signed-in staff member's permission list.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /**
   * The permission needed to see the item, matching `requirePermission` in
   * `src/lib/staff.ts` so a link and the page behind it can never disagree about
   * who is allowed in.
   */
  permission?: string;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: "grid",
        permission: "dashboard.view",
        exact: true,
      },
      {
        href: "/admin/reports",
        label: "Reports",
        icon: "chart",
        permission: "reports.view",
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        href: "/admin/orders",
        label: "Orders",
        icon: "cart",
        permission: "orders.view",
      },
      {
        href: "/admin/quotes",
        label: "Quotes",
        icon: "quote",
        permission: "quotes.view",
      },
      {
        href: "/admin/customers",
        label: "Customers",
        icon: "users",
        permission: "customers.view",
      },
      {
        href: "/admin/team",
        label: "Team",
        icon: "users",
        permission: "staff.view",
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        icon: "box",
        permission: "products.view",
      },
      {
        href: "/admin/categories",
        label: "Categories",
        icon: "tag",
        permission: "products.view",
      },
      {
        href: "/admin/navigation",
        label: "Navigation",
        icon: "layout",
        permission: "products.edit",
      },
      {
        href: "/admin/menu-images",
        label: "Menu Images",
        icon: "image",
        permission: "products.edit",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        href: "/admin/content",
        label: "Content",
        icon: "layout",
        permission: "content.edit",
      },
      {
        href: "/admin/gallery",
        label: "Gallery",
        icon: "image",
        permission: "media.edit",
      },
      {
        href: "/admin/media",
        label: "Media & Banners",
        icon: "image",
        permission: "media.edit",
      },
      {
        href: "/admin/staff",
        label: "Staff & roles",
        icon: "shield",
        permission: "staff.view",
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: "cog",
        permission: "settings.edit",
      },
    ],
  },
];

export const ALL_PERMISSIONS = [
  { key: "dashboard.view", label: "View dashboard" },
  { key: "products.view", label: "View products" },
  { key: "products.edit", label: "Edit products" },
  { key: "orders.view", label: "View orders" },
  { key: "orders.edit", label: "Edit orders" },
  { key: "customers.view", label: "View customers" },
  { key: "customers.edit", label: "Edit customers" },
  { key: "quotes.view", label: "View quotes" },
  { key: "quotes.edit", label: "Edit quotes" },
  { key: "content.edit", label: "Manage content" },
  { key: "media.edit", label: "Manage media & banners" },
  { key: "reports.view", label: "View reports" },
  { key: "staff.view", label: "View staff" },
  { key: "staff.edit", label: "Edit staff" },
  { key: "settings.edit", label: "Edit settings" },
] as const;

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The database column is a free-form VARCHAR defaulting to 'new', and the
 * existing storefront inbox already uses 'new' / 'replied' / 'closed'. The
 * admin workflow adds the richer states so the column can carry the full
 * lifecycle without breaking anything already shipped.
 */
export const QUOTE_STATUSES_ADMIN = [
  "new",
  "quoted",
  "replied",
  "accepted",
  "rejected",
  "closed",
] as const;
export type QuoteStatusAdmin = (typeof QUOTE_STATUSES_ADMIN)[number];

/** Quote states that can be turned into an order. */
export const CONVERTIBLE_QUOTE_STATUSES: QuoteStatusAdmin[] = [
  "accepted",
  "quoted",
];
