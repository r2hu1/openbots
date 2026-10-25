import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    "@openbots/ui",
    "@openbots/api-client",
    "@openbots/api-contract",
  ],
  output: "standalone",
}

export default nextConfig
