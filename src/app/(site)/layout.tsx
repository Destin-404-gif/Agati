import Footer from "@/components/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import Navbar from "@/components/navbar/Navbar";
import { getMedia } from "@/lib/media";
import { getNavigationData } from "@/lib/navigation-data";

/**
 * Public storefront chrome. Kept in its own route group so the admin routes
 * render without the marketing navbar and footer.
 *
 * The cart provider sits above the navbar so the badge in the header and the
 * buttons on the pages below it share one store.
 *
 * Branding and category panels are read from `media_slots` here, once, and
 * handed down as props. Reading them in the layout rather than in each consumer
 * means the header, the footer, the mega-menu and every page agree on the same
 * asset - and one query covers all of them.
 *
 * `force-dynamic` is load-bearing: without it this segment would be prerendered
 * at build time and an admin's upload would not appear until the next deploy.
 */
export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [media, navigation] = await Promise.all([
    getMedia(["logo"]),
    getNavigationData(),
  ]);

  return (
    <CartProvider>
      <Navbar
        logo={media.logo ?? null}
        navigation={navigation}
      />
      {children}
      <Footer logo={media.logo ?? null} />
    </CartProvider>
  );
}