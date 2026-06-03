import type { NextConfig } from "next";
import path from "node:path";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  ...withPWA({}),
  turbopack: {
    // Monorepo: pin the workspace root to web/ so tailwindcss resolves from
    // web/node_modules instead of the repo root.
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
