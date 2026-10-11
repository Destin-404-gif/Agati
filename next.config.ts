import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // `pg` uses native Node APIs; keep it out of the bundler.
  serverExternalPackages: ["pg"],
  images: {
    // Next 16 only serves allowlisted qualities; the hero renders at 90.
    qualities: [75, 90],
    // Image links may come from any host (Drive, unsplash, placehold, a client's
    // own CDN…) so every https host is allowed. `unoptimized` images are not
    // proxied, and uploads are served from the same origin, so this is only the
    // optimizer acting as a cache in front of a remote.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "**.placehold.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
