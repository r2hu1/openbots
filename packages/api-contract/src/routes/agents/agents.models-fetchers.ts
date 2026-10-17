export type AvailableModel = {
  id: string;
  displayName: string;
  description?: string;
  provider?: string;
};

export async function fetchLiveGoogleModels(
  apiKey: string,
): Promise<AvailableModel[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    if (!data?.models) return [];
    return data.models
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => {
        const cleanId = m.name.replace("models/", "");
        return {
          id: `google/${cleanId}`,
          displayName: m.displayName || cleanId,
          description: m.description,
          provider: "google",
        };
      });
  } catch (err) {
    console.warn("Failed to fetch live Google models:", err);
    return [];
  }
}

export async function fetchLiveOpenAICompatibleModels(
  provider: "openai" | "openrouter" | "groq" | "xai" | "deepseek",
  apiKey: string,
  url: string,
): Promise<AvailableModel[]> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ id: string; name?: string; description?: string }>;
    };
    if (!data?.data || !Array.isArray(data.data)) return [];

    let filtered = data.data;

    // Filter relevant models for OpenAI
    if (provider === "openai") {
      filtered = filtered.filter(
        (m) =>
          (m.id.startsWith("gpt-") ||
            m.id.startsWith("o1") ||
            m.id.startsWith("o3") ||
            m.id.startsWith("chatgpt")) &&
          !m.id.includes("realtime") &&
          !m.id.includes("audio") &&
          !m.id.includes("transcription"),
      );
    }

    return filtered.map((m) => ({
      id: `${provider}/${m.id}`,
      displayName: m.name || m.id,
      description: m.description,
      provider,
    }));
  } catch (err) {
    console.warn(`Failed to fetch live models for ${provider}:`, err);
    return [];
  }
}

export async function fetchLiveAnthropicModels(
  apiKey: string,
): Promise<AvailableModel[]> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ id: string; display_name?: string }>;
    };
    if (!data?.data || !Array.isArray(data.data)) return [];
    return data.data.map((m) => ({
      id: `anthropic/${m.id}`,
      displayName: m.display_name || m.id,
      provider: "anthropic",
    }));
  } catch (err) {
    console.warn("Failed to fetch live Anthropic models:", err);
    return [];
  }
}
