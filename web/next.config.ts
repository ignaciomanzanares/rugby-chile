import type { NextConfig } from "next";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  ...withPWA({}),
  experimental: {
    // Turbopack's dev FileSystem cache is ON by default since Next 16.1 and
    // writes hundreds of MB of .sst files into .next/dev/cache/turbopack. On
    // this low-RAM laptop those writes saturate disk I/O (load spiked to 14)
    // and the cache had ballooned to 2.5 GB. Disable it: cold starts are a bit
    // slower, but no I/O storms and no runaway .next.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    // Monorepo root (where package-lock.json lives). Turbopack only resolves
    // modules inside the root, so this is required to reach socket.io-client's
    // transitive deps that npm hoisted to the repo-root node_modules
    // (@socket.io/component-emitter, debug, engine.io-parser). web/-local
    // packages like tailwindcss still resolve via normal upward lookup.
    root: path.resolve(__dirname, ".."),
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
