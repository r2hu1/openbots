export type SupportedLlmProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "google"
  | "groq"
  | "xai"
  | "deepseek"

export interface ProviderKeyMeta {
  provider: SupportedLlmProvider
  name: string
  description: string
  docsUrl: string
  placeholder: string
  envFallbackName: string
}

export const LLM_PROVIDERS: ProviderKeyMeta[] = [
  {
    provider: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4.5, o1, o3-mini and embeddings models.",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-proj-...",
    envFallbackName: "OPENAI_API_KEY",
  },
  {
    provider: "anthropic",
    name: "Anthropic",
    description: "Claude 3.7 Sonnet, Claude 3.5 Haiku, and Claude 3 Opus.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
    envFallbackName: "ANTHROPIC_API_KEY",
  },
  {
    provider: "openrouter",
    name: "OpenRouter",
    description: "Unified API for 200+ models with competitive routing.",
    docsUrl: "https://openrouter.ai/settings/keys",
    placeholder: "sk-or-v1-...",
    envFallbackName: "OPENROUTER_API_KEY",
  },
  {
    provider: "google",
    name: "Google AI (Gemini)",
    description: "Gemini 2.5 Pro, Flash, Flash-Lite, and 1.5 models.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIzaSy...",
    envFallbackName: "GEMINI_API_KEY",
  },
  {
    provider: "groq",
    name: "Groq",
    description:
      "Ultra-fast LPU inference for Llama 3.3, DeepSeek, and Mixtral.",
    docsUrl: "https://console.groq.com/keys",
    placeholder: "gsk_...",
    envFallbackName: "GROQ_API_KEY",
  },
  {
    provider: "xai",
    name: "Grok (xAI)",
    description: "Grok 2 and Grok Beta models with live knowledge.",
    docsUrl: "https://console.x.ai/",
    placeholder: "xai-...",
    envFallbackName: "XAI_API_KEY",
  },
  {
    provider: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek-V3 and DeepSeek-R1 reasoning models.",
    docsUrl: "https://platform.deepseek.com/api_keys",
    placeholder: "sk-...",
    envFallbackName: "DEEPSEEK_API_KEY",
  },
]

export interface ConfiguredKeyInfo {
  provider: SupportedLlmProvider
  keyHint?: string
  updatedAt?: string | Date
}
