import { defineConfig } from "@trigger.dev/sdk";
import { aptGet } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  runtime: "node-24",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    external: ["playwright-core", "chromium-bidi"],
    extensions: [
      aptGet({ packages: ["git", "curl", "jq", "python3", "ripgrep"] }),
    ],
  },
});
