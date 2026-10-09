import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // `pg` uses native Node APIs; keep it out of the bundler.
  serverExternalPackages: ["pg"],
  images: {
    // Next 16 only serves allowlisted qualities; the hero renders at 90.
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "**.placehold.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
