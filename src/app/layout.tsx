import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { localBusinessJsonLd, SITE } from "@/lib/siteConfig";
import "./globals.css";

/**
 * Heavy, rounded display face for the oversized wordmark and section titles.
 * Fraunces is a variable font, so one query covers every weight. Listing
 * `weight`/`style` arrays makes next/font emit a file per face, which trips
 * Turbopack's font replacer ("next/font/google queries have exactly one entry").
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

/** Clean grotesk for body copy. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Every published detail - title, description, place - comes from `siteConfig`,
 * so the metadata and the visible page can never disagree. Phone and email are
 * deliberately left out of the page metadata: search engines ignore them, and
 * the JSON-LD below is the place structured contact data belongs.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} - Solid hardwood & custom furniture`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    title: `${SITE.name} - Solid hardwood & custom furniture`,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    locale: "en_RW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} - Solid hardwood & custom furniture`,
    description: SITE.description,
  },
};

const THEME_INIT = `(function(){try{var k="agati-theme";var s=localStorage.getItem(k);var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/*
          schema.org LocalBusiness, built from the same siteConfig the pages
          render from. JSON.stringify escapes the quotes, and the leading `<`
          guard stops anything in the data from closing the script tag early.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessJsonLd()).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
