import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import {
  deleteUserApiKey,
  isSupportedProvider,
  listUserApiKeys,
  saveUserApiKey,
} from "./api-keys.logic.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const apiKeysRoute = new Hono<Env>()
  .use("*", authMiddleware)

  // GET /api/api-keys - returns list of configured providers and hints
  .get("/", async (c) => {
    const user = c.get("user");
    const result = await listUserApiKeys(user.id);
    return c.json(result);
  })

  // POST /api/api-keys - securely save encrypted key
  .post("/", async (c) => {
    const user = c.get("user");
    const body = (await c.req.json().catch(() => ({}))) as {
      provider?: string;
      apiKey?: string;
    };

    if (!body.provider || !isSupportedProvider(body.provider)) {
      return c.json(
        {
          error:
            "Invalid or unsupported provider. Supported: openai, anthropic, openrouter, google, groq, xai, deepseek",
        },
        400,
      );
    }

    if (
      !body.apiKey ||
      typeof body.apiKey !== "string" ||
      body.apiKey.trim().length < 5
    ) {
      return c.json({ error: "Invalid API key format" }, 400);
    }

    try {
      const saved = await saveUserApiKey(user.id, body.provider, body.apiKey);
      return c.json({ success: true, key: saved }, 200);
    } catch (err: any) {
      return c.json(
        { error: err?.message || "Failed to encrypt and store API key" },
        500,
      );
    }
  })

  // DELETE /api/api-keys/:provider - delete a configured key
  .delete("/:provider", async (c) => {
    const user = c.get("user");
    const provider = c.req.param("provider");
    const result = await deleteUserApiKey(user.id, provider);
    return c.json(result);
  });
