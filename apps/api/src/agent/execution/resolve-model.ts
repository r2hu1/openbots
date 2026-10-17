import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getApiKeyForModel } from "@openbots/api-contract";

export async function resolveModel(userId: string, modelName: string) {
  const apiKey = await getApiKeyForModel(userId, modelName);
  const normalized = modelName.trim();

  // 1. Google Gemini
  if (
    normalized.startsWith("google/") ||
    normalized.startsWith("gemini-") ||
    normalized === "default"
  ) {
    const key =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      throw new Error(
        "Google API Key is not configured. Please add your Gemini API key in Settings > API Keys.",
      );
    }
    const client = createGoogleGenerativeAI({ apiKey: key });
    const cleanId = normalized.replace("google/", "");
    return client(cleanId || "gemini-2.5-flash");
  }

  // 2. OpenAI
  if (normalized.startsWith("openai/")) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OpenAI API Key is not configured. Please add your OpenAI API key in Settings > API Keys.",
      );
    }
    const client = createOpenAI({ apiKey: key });
    return client(normalized.replace("openai/", ""));
  }

  // 3. Anthropic
  if (normalized.startsWith("anthropic/")) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "Anthropic API Key is not configured. Please add your Anthropic API key in Settings > API Keys.",
      );
    }
    const client = createAnthropic({ apiKey: key });
    return client(normalized.replace("anthropic/", ""));
  }

  // 4. DeepSeek (OpenAI-compatible)
  if (normalized.startsWith("deepseek/")) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) {
      throw new Error(
        "DeepSeek API Key is not configured. Please add your DeepSeek API key in Settings > API Keys.",
      );
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://api.deepseek.com/v1",
    });
    return client(normalized.replace("deepseek/", ""));
  }

  // 5. Groq (OpenAI-compatible)
  if (normalized.startsWith("groq/")) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error(
        "Groq API Key is not configured. Please add your Groq API key in Settings > API Keys.",
      );
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://api.groq.com/openai/v1",
    });
    return client(normalized.replace("groq/", ""));
  }

  // 6. xAI Grok (OpenAI-compatible)
  if (normalized.startsWith("xai/") || normalized.startsWith("grok/")) {
    const key = apiKey || process.env.XAI_API_KEY;
    if (!key) {
      throw new Error(
        "xAI API Key is not configured. Please add your xAI API key in Settings > API Keys.",
      );
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://api.x.ai/v1",
    });
    return client(normalized.replace("xai/", "").replace("grok/", ""));
  }

  // 7. OpenRouter (OpenAI-compatible)
  if (normalized.startsWith("openrouter/")) {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error(
        "OpenRouter API Key is not configured. Please add your OpenRouter API key in Settings > API Keys.",
      );
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
    });
    return client(normalized.replace("openrouter/", ""));
  }

  // Fallback to Google Gemini
  const key =
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    throw new Error(
      "No API key configured for model. Please configure your API key in Settings > API Keys.",
    );
  }
  const client = createGoogleGenerativeAI({ apiKey: key });
  return client("gemini-2.5-flash");
}
