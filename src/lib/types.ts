export type Category = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  image_alt?: string | null;
  description?: string | null;
  icon?: string;
  sort_order?: number;
  product_count?: number;
};

/* ------------------------------------------------------------- quote inbox */

export type QuoteStatus = "new" | "replied" | "closed";

/** The only statuses the workshop inbox may set - mirrors the seed data. */
export const QUOTE_STATUSES: QuoteStatus[] = ["new", "replied", "closed"];

export type Quote = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  message: string | null;
  product_slug: string | null;
  status: string;
  created_at: string;
};

export type ProductImage = {
  id: number;
  image_url: string;
  position: number;
};

export type ProductVariant = {
  id: number;
  variant_name: string | null;
  color: string | null;
  price_modifier: string;
  image_url: string | null;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  price: string;
  category_id: number | null;
  subcategory_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  is_new: boolean;
  is_featured: boolean;
  /** Made to measure: priced per commission, so it gets a quote, not a cart button. */
  is_custom: boolean;
  stock_quantity: number;
  created_at: string;
  image_url: string | null;
};

export type ProductDetail = Product & {
  images: ProductImage[];
  variants: ProductVariant[];
};

export type CartLine = {
  id: number;
  quantity: number;
  product_id: number;
  variant_id: number | null;
  product_name: string;
  product_slug: string;
  image_url: string | null;
  variant_name: string | null;
  price_modifier: string;
  unit_price: string;
  line_total: string;
};

export type Order = {
  id: number;
  user_id: number | null;
  status: string;
  total: string;
  created_at: string;
};

/**
 * A storefront order as the customer sees it on the confirmation page. Only
 * fields the customer already supplied are exposed - nothing about the staff
 * side of the order, and no account details beyond their own name and phone.
 */
export type CustomerOrder = {
  order_number: string;
  status: string;
  total: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_district: string | null;
  delivery_sector: string | null;
  delivery_landmark: string | null;
  delivery_note: string | null;
  payment_method: string | null;
  items: {
    id: number;
    product_id: number | null;
    slug: string | null;
    name: string | null;
    variant_name: string | null;
    image_url: string | null;
    quantity: number;
    unit_price: string;
    line_total: string;
  }[];
};
