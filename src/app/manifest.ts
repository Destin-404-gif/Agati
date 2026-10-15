import type { MetadataRoute } from "next";
import { LOGO_HEIGHT, LOGO_SRC, LOGO_WIDTH, SITE } from "@/lib/siteConfig";

/**
 * Web app manifest. Reuses the same brand mark and one-line description as the
 * rest of the metadata, so an install prompt and the browser tab agree.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f1ece1",
    theme_color: "#241c14",
    icons: [
      {
        src: LOGO_SRC,
        sizes: `${LOGO_WIDTH}x${LOGO_HEIGHT}`,
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
