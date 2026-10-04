import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@openbots/ui",
    "@openbots/api-client",
    "@openbots/api-contract",
  ],
};

export default nextConfig;
