export const SUPPORTED_PROVIDERS = [
  "openai",
  "anthropic",
  "openrouter",
  "google",
  "groq",
  "xai",
  "deepseek",
] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(
  provider: string,
): provider is SupportedProvider {
  return SUPPORTED_PROVIDERS.includes(provider as SupportedProvider);
}

/**
 * Maps model string prefix (e.g. "openai/gpt-4o", "anthropic/claude-3-5-sonnet") to SupportedProvider.
 */
export function getProviderFromModel(
  modelString: string,
): SupportedProvider | null {
  const prefix = modelString.split("/")[0]?.toLowerCase();
  switch (prefix) {
    case "openai":
      return "openai";
    case "anthropic":
      return "anthropic";
    case "openrouter":
      return "openrouter";
    case "google":
    case "gemini":
      return "google";
    case "groq":
      return "groq";
    case "xai":
    case "grok":
      return "xai";
    case "deepseek":
      return "deepseek";
    default:
      return null;
  }
}
