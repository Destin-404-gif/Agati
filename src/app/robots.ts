import type { MetadataRoute } from "next";
import { SITE } from "@/lib/siteConfig";

/**
 * Generated robots.txt.
 *
 * Only the two non-content trees are disallowed: the authenticated admin area
 * and the JSON API. Everything a visitor can read stays crawlable so the
 * noindex directives on the cart, checkout, order and search pages can actually
 * be seen - a URL blocked here could never surface its own noindex tag.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
