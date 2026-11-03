import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deliberately disabled. NEXUS is a client-state-driven application whose
  // seed data is relative to the current date, and every route is an interactive
  // shell. Cache Components / partial prefetching add no value here and would
  // force time-dependent reads into Suspense boundaries for no user benefit.
  cacheComponents: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
