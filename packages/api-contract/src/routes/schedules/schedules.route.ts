import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  updateSchedule,
} from "./schedules.logic.js";
import {
  createScheduleInputSchema,
  updateScheduleInputSchema,
} from "./schedules.schema.js";

type Env = {
  Variables: {
    user: { id: string };
  };
};

export const schedulesRoute = new Hono<Env>()
  .use("*", authMiddleware)
  .get("/", async (c) => {
    const user = c.get("user");
    const agentId = c.req.query("agentId");
    const result = await listSchedules(user.id, agentId);
    return c.json(result);
  })
  .get("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const schedule = await getSchedule(id, user.id);
    if (!schedule) {
      return c.json({ error: "Schedule not found" }, 404);
    }
    return c.json({ schedule });
  })
  .post("/", zValidator("json", createScheduleInputSchema), async (c) => {
    const user = c.get("user");
    const data = c.req.valid("json");
    try {
      const result = await createSchedule(user.id, data);
      return c.json(result, 201);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create schedule";
      return c.json({ error: message }, 500);
    }
  })
  .patch("/:id", zValidator("json", updateScheduleInputSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const result = await updateSchedule(id, user.id, data);
    if (!result) {
      return c.json({ error: "Schedule not found" }, 404);
    }
    return c.json(result);
  })
  .delete("/:id", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const result = await deleteSchedule(id, user.id);
    if (!result) {
      return c.json({ error: "Schedule not found" }, 404);
    }
    return c.json(result);
  });
