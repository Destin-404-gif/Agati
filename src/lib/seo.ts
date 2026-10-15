import { CURRENCY, SITE } from "./siteConfig";
import type { ProductDetail } from "./types";

/**
 * schema.org payloads the storefront publishes on top of the LocalBusiness
 * block in the root layout.
 *
 * Everything is derived from `siteConfig` and the row the page already renders,
 * so the structured data can never advertise a URL, a price or a name that the
 * visitor cannot see on the same page. Nothing here invents a review, a rating,
 * a shipping policy or an availability claim.
 */

/** The site itself, with the internal search box exposed as a sitelink action. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** One breadcrumb trail, matching the visible `<nav aria-label="Breadcrumb">`. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE.url}${item.path}`,
    })),
  };
}

/**
 * A single catalogue piece.
 *
 * `offers` is only attached to in-stock catalogue items: a made-to-measure
 * piece is priced per commission and has no fixed sale offer, so claiming one
 * would misrepresent it. Absence of `offers` is valid Product markup.
 */
export function productJsonLd(product: ProductDetail) {
  const url = `${SITE.url}/furniture/${product.slug}`;
  const images = [product.image_url, ...product.images.map((image) => image.image_url)].filter(
    (src): src is string => Boolean(src),
  );

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    sku: product.sku ?? undefined,
    image: images.length ? images : undefined,
    brand: { "@type": "Brand", name: SITE.name },
    category: product.category_name ?? undefined,
    url,
    ...(product.is_custom
      ? {}
      : {
          offers: {
            "@type": "Offer",
            url,
            price: product.price,
            priceCurrency: CURRENCY.code,
            availability:
              product.stock_quantity > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }),
  };
}
