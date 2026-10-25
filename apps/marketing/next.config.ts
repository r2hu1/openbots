import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  transpilePackages: [
    "@openbots/ui",
    "@openbots/api-client",
    "@openbots/api-contract",
  ],
  output: "standalone",
}

export default nextConfig
