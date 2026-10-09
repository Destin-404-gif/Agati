import { query } from "./db";

export type NavbarKey = "top_bar" | "category_bar";

export interface MegaMenuSection {
  id: number;
  nav_item_id: number;
  group_label: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  image: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface NavigationItem {
  id: number;
  navbar: NavbarKey;
  label: string;
  slug: string;
  description: string | null;
  icon: string;
  has_mega_menu: boolean;
  sort_order: number;
  is_active: boolean;
  sections: MegaMenuSection[];
}

export interface NavigationData {
  top_bar: NavigationItem[];
  category_bar: NavigationItem[];
}

type NavigationRow = Omit<NavigationItem, "sections"> & {
  section_id: number | null;
  section_group_label: string | null;
  section_name: string | null;
  section_slug: string | null;
  section_description: string | null;
  section_icon: string | null;
  image: string | null;
  section_sort_order: number | null;
  section_is_active: boolean | null;
};

export async function getNavigationData(includeInactive = false): Promise<NavigationData> {
  const rows = await query<NavigationRow>(
        `SELECT n.id, n.navbar, n.label, n.slug, n.description, n.icon, n.has_mega_menu,
          n.sort_order, n.is_active,
            s.id AS section_id, s.group_label AS section_group_label,
            s.name AS section_name,
            s.slug AS section_slug, s.description AS section_description,
            s.icon AS section_icon,
            s.image, s.sort_order AS section_sort_order,
            s.is_active AS section_is_active
       FROM nav_items n
       LEFT JOIN mega_menu_sections s
         ON s.nav_item_id = n.id ${includeInactive ? "" : "AND s.is_active = TRUE"}
      WHERE n.navbar = 'top_bar' ${includeInactive ? "" : "AND n.is_active = TRUE"}
      ORDER BY n.navbar, n.sort_order, n.id, s.sort_order, s.id`,
  );

  const result: NavigationData = { top_bar: [], category_bar: [] };
  const topById = new Map<number, NavigationItem>();

  for (const row of rows) {
    let item = topById.get(row.id);
    if (!item) {
      item = {
        id: row.id,
        navbar: row.navbar,
        label: row.label,
        slug: row.slug,
        description: row.description,
        icon: row.icon,
        has_mega_menu: row.has_mega_menu,
        sort_order: row.sort_order,
        is_active: row.is_active,
        sections: [],
      };
      topById.set(item.id, item);
      result[item.navbar].push(item);
    }

    if (row.section_id != null) {
      item.sections.push({
        id: row.section_id,
        nav_item_id: row.id,
        group_label: row.section_group_label ?? "Shop by type",
        name: row.section_name ?? "",
        slug: row.section_slug ?? "",
        description: row.section_description,
        icon: row.section_icon ?? "Package",
        image: row.image,
        sort_order: row.section_sort_order ?? 0,
        is_active: row.section_is_active ?? false,
      });
    }
  }

  const categoryRows = await query<{
    id: number;
    label: string;
    slug: string;
    description: string | null;
    icon: string;
    sort_order: number;
    section_id: number | null;
    section_name: string | null;
    section_slug: string | null;
    section_icon: string | null;
    section_sort_order: number | null;
  }>(
    `SELECT c.id, c.name AS label, c.slug, c.description, c.icon, c.sort_order,
            s.id AS section_id, s.name AS section_name, s.slug AS section_slug,
            s.icon AS section_icon, s.position AS section_sort_order
       FROM categories c
       LEFT JOIN subcategories s ON s.category_id = c.id
      ${includeInactive ? "" : "WHERE c.is_active = TRUE"}
      ORDER BY c.sort_order, c.id, s.position, s.id`,
  );
  const categoryById = new Map<number, NavigationItem>();
  for (const row of categoryRows) {
    let item = categoryById.get(row.id);
    if (!item) {
      item = {
        id: row.id,
        navbar: "category_bar",
        label: row.label,
        slug: row.slug,
        description: row.description,
        icon: row.icon,
        has_mega_menu: false,
        sort_order: row.sort_order,
        is_active: true,
        sections: [],
      };
      categoryById.set(item.id, item);
      result.category_bar.push(item);
    }
    if (row.section_id != null) {
      item.has_mega_menu = true;
      item.sections.push({
        id: row.section_id,
        nav_item_id: row.id,
        group_label: "Shop by type",
        name: row.section_name ?? "",
        slug: row.section_slug ?? "",
        description: null,
        icon: row.section_icon ?? "Package",
        image: null,
        sort_order: row.section_sort_order ?? 0,
        is_active: true,
      });
    }
  }

  return result;
}