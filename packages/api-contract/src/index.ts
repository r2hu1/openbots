import { Hono } from "hono";
import { auth } from "./lib/auth.js";
import { corsMiddleware } from "./middleware/cors.js";
import { agentsRoute } from "./routes/agents/agents.route.js";
import { apiKeysRoute } from "./routes/api-keys/api-keys.route.js";
import { connectionsRoute } from "./routes/connections/connections.route.js";
import { conversationsRoute } from "./routes/conversations/conversations.route.js";
import { runsRoute } from "./routes/runs/runs.route.js";
import { schedulesRoute } from "./routes/schedules/schedules.route.js";
import { tasksRoute } from "./routes/tasks/tasks.route.js";

const app = new Hono()
  .use("*", corsMiddleware)
  .basePath("/api")
  .get("/health", (c) => {
    return c.json({ status: "ok" });
  })
  .on(["POST", "GET", "OPTIONS"], "/auth/*", (c) => auth.handler(c.req.raw))
  .route("/agents", agentsRoute)
  .route("/api-keys", apiKeysRoute)
  .route("/tasks", tasksRoute)
  .route("/runs", runsRoute)
  .route("/schedules", schedulesRoute)
  .route("/conversations", conversationsRoute)
  .route("/connections", connectionsRoute);

export type AppType = typeof app;
export * from "./routes/agents/agents.logic.js";
export * from "./routes/api-keys/api-keys.logic.js";
export * from "./routes/conversations/conversations.logic.js";
export * from "./routes/runs/runs.logic.js";
export * from "./routes/schedules/schedules.logic.js";
export { app };
