import Browserbase from "@browserbasehq/sdk";

let bbClientInstance: Browserbase | null = null;

export function getBrowserbaseClient(): Browserbase | null {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!bbClientInstance) {
    bbClientInstance = new Browserbase({ apiKey });
  }

  return bbClientInstance;
}

export function getBrowserbaseProjectId(): string | undefined {
  return process.env.BROWSERBASE_PROJECT_ID;
}
