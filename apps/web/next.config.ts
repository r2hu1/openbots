import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openbots/ui",
    "@openbots/api-client",
    "@openbots/api-contract",
  ],
  output: "standalone",
}

export default nextConfig
