import {
  getDecryptedUserApiKey,
  listUserApiKeys,
} from "../api-keys/api-keys.logic.js";
import {
  type AvailableModel,
  fetchLiveAnthropicModels,
  fetchLiveGoogleModels,
  fetchLiveOpenAICompatibleModels,
} from "./agents.models-fetchers.js";

export * from "./agents.models-fetchers.js";

export async function listAvailableModels(userId?: string) {
  if (!userId) {
    return { models: [] };
  }

  // Get user's configured keys
  const userKeysResult = await listUserApiKeys(userId);
  const configuredProviders = new Set(
    userKeysResult.keys.map((k) => k.provider),
  );

  const allModels: AvailableModel[] = [];

  // Fetch in parallel for each configured provider
  const fetchPromises: Array<Promise<AvailableModel[]>> = [];

  if (configuredProviders.has("google")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "google");
        if (!key) return [];
        const live = await fetchLiveGoogleModels(key);
        if (live.length > 0) return live;
        return [
          {
            id: "google/gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            provider: "google",
          },
          {
            id: "google/gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            provider: "google",
          },
          {
            id: "google/gemini-2.0-flash",
            displayName: "Gemini 2.0 Flash",
            provider: "google",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("openai")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "openai");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "openai",
          key,
          "https://api.openai.com/v1/models",
        );
        if (live.length > 0) return live;
        return [
          { id: "openai/gpt-4o", displayName: "GPT-4o", provider: "openai" },
          {
            id: "openai/gpt-4o-mini",
            displayName: "GPT-4o mini",
            provider: "openai",
          },
          { id: "openai/o3-mini", displayName: "o3-mini", provider: "openai" },
        ];
      })(),
    );
  }

  if (configuredProviders.has("anthropic")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "anthropic");
        if (!key) return [];
        const live = await fetchLiveAnthropicModels(key);
        if (live.length > 0) return live;
        return [
          {
            id: "anthropic/claude-3-7-sonnet",
            displayName: "Claude 3.7 Sonnet",
            provider: "anthropic",
          },
          {
            id: "anthropic/claude-3-5-sonnet",
            displayName: "Claude 3.5 Sonnet",
            provider: "anthropic",
          },
          {
            id: "anthropic/claude-3-5-haiku",
            displayName: "Claude 3.5 Haiku",
            provider: "anthropic",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("deepseek")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "deepseek");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "deepseek",
          key,
          "https://api.deepseek.com/v1/models",
        );
        if (live.length > 0) return live;
        return [
          {
            id: "deepseek/deepseek-chat",
            displayName: "DeepSeek V3",
            provider: "deepseek",
          },
          {
            id: "deepseek/deepseek-reasoner",
            displayName: "DeepSeek R1",
            provider: "deepseek",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("groq")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "groq");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "groq",
          key,
          "https://api.groq.com/openai/v1/models",
        );
        if (live.length > 0) return live;
        return [
          {
            id: "groq/llama-3.3-70b-versatile",
            displayName: "Llama 3.3 70B",
            provider: "groq",
          },
        ];
      })(),
    );
  }

  if (configuredProviders.has("xai")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "xai");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "xai",
          key,
          "https://api.x.ai/v1/models",
        );
        if (live.length > 0) return live;
        return [{ id: "xai/grok-2", displayName: "Grok 2", provider: "xai" }];
      })(),
    );
  }

  if (configuredProviders.has("openrouter")) {
    fetchPromises.push(
      (async () => {
        const key = await getDecryptedUserApiKey(userId, "openrouter");
        if (!key) return [];
        const live = await fetchLiveOpenAICompatibleModels(
          "openrouter",
          key,
          "https://openrouter.ai/api/v1/models",
        );
        if (live.length > 0) return live;
        return [
          {
            id: "openrouter/auto",
            displayName: "OpenRouter Auto",
            provider: "openrouter",
          },
        ];
      })(),
    );
  }

  const results = await Promise.all(fetchPromises);
  for (const list of results) {
    allModels.push(...list);
  }

  return {
    models: allModels,
  };
}
