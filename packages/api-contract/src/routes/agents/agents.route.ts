import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import { handleAgentFiles } from "./agents.files.js";
import {
  createAgent,
  createAgentRun,
  deleteAgent,
  getAgent,
  getAgentSummary,
  getAgentTools,
  listAgents,
  listAvailableModels,
  toggleAgentTool,
  updateAgent,
} from "./agents.logic.js";
import {
  configureToolSchema,
  createAgentRunSchema,
  createAgentSchema,
  updateAgentSchema,
} from "./agents.schema.js";
import { handleAgentStream, handleUserAgentsStream } from "./agents.stream.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const agentsRoute = new Hono<Env>()
  .get("/:id/summary", async (c) => {
    const id = c.req.param("id");
    const summary = await getAgentSummary(id);
    if (!summary) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json({ agent: summary });
  })

  .use("*", authMiddleware)

  .get("/models", async (c) => {
    const user = c.get("user");
    const result = await listAvailableModels(user.id);
    return c.json(result);
  })
  .get("/", async (c) => {
    const user = c.get("user");
    const result = await listAgents(user.id);
    return c.json(result);
  })

  .get("/stream", handleUserAgentsStream)

  .get("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await getAgent(id, user.id);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .patch("/:id", zValidator("json", updateAgentSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const result = await updateAgent(id, user.id, data);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .get("/:id/tools", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await getAgentTools(id, user.id);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .post("/:id/tools", zValidator("json", configureToolSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const result = await toggleAgentTool(id, user.id, data);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(result);
  })
  .get("/:id/files", handleAgentFiles)
  .post("/", zValidator("json", createAgentSchema), async (c) => {
    const user = c.get("user");
    const data = c.req.valid("json");
    const result = await createAgent(user.id, data);
    return c.json(result, 201);
  })
  .post("/:id/runs", zValidator("json", createAgentRunSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");

    // Extract geo and timezone headers if present from edge proxy (Cloudflare, Vercel, AWS CloudFront)
    const geoCity =
      c.req.header("cf-ipcity") ||
      c.req.header("x-vercel-ip-city") ||
      c.req.header("x-geo-city") ||
      undefined;
    const geoRegion =
      c.req.header("cf-region") ||
      c.req.header("x-vercel-ip-country-region") ||
      c.req.header("x-geo-region") ||
      undefined;
    const geoCountry =
      c.req.header("cf-ipcountry") ||
      c.req.header("x-vercel-ip-country") ||
      c.req.header("x-geo-country") ||
      undefined;
    const geoTimezone =
      c.req.header("cf-timezone") ||
      c.req.header("x-vercel-ip-timezone") ||
      undefined;

    const enrichedClientContext = {
      ...data.clientContext,
      timezone: data.clientContext?.timezone || geoTimezone,
      city: data.clientContext?.city || geoCity,
      region: data.clientContext?.region || geoRegion,
      country: data.clientContext?.country || geoCountry,
    };

    const result = await createAgentRun(user.id, id, {
      ...data,
      clientContext: enrichedClientContext,
    });
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({ run: result.run }, 201);
  })
  .delete("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await deleteAgent(id, user.id);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json({ success: true, agent: result.agent });
  })
  .get("/:id/stream", handleAgentStream);
