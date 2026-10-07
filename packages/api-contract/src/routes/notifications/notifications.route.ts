import { zValidator } from "@hono/zod-validator";
import { db, pushSubscriptions } from "@openbots/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth.js";
import { sendUserPushNotification } from "../../services/notifications.service.js";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

type Env = {
  Variables: {
    user: { id: string; name?: string; email?: string };
  };
};

export const notificationsRoute = new Hono<Env>()
  // Public key retrieval so frontend can subscribe
  .get("/public-key", (c) => {
    const publicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    return c.json({
      publicKey: publicKey || null,
    });
  })
  .use("*", authMiddleware)
  // Subscribe browser endpoint
  .post("/subscribe", zValidator("json", subscribeSchema), async (c) => {
    const user = c.get("user");
    const { endpoint, keys, userAgent } = c.req.valid("json");

    // Upsert subscription
    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));

    if (existing) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: user.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: userAgent ?? c.req.header("user-agent") ?? null,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing.id));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? c.req.header("user-agent") ?? null,
      });
    }

    return c.json({ success: true, message: "Subscribed to push notifications" });
  })
  // Unsubscribe browser endpoint
  .post("/unsubscribe", zValidator("json", unsubscribeSchema), async (c) => {
    const user = c.get("user");
    const { endpoint } = c.req.valid("json");

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.userId, user.id),
        ),
      );

    return c.json({ success: true, message: "Unsubscribed from push notifications" });
  })
  // Test push notification endpoint for the current user
  .post("/test", async (c) => {
    const user = c.get("user");
    const result = await sendUserPushNotification(user.id, {
      title: "OpenBots Test Notification 🚀",
      body: "Push notifications are working perfectly on this device!",
      url: "/",
    });
    return c.json({ success: true, ...result });
  });
