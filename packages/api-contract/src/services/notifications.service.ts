import { db, pushSubscriptions } from "@openbots/db";
import { eq } from "drizzle-orm";
import webpush from "web-push";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const subject = process.env.VAPID_SUBJECT || "mailto:admin@openbots.dev";
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn(
      "[Web Push] VAPID keys not configured (missing NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY)",
    );
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.warn("Failed to initialize web-push VAPID details:", err);
    return false;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Sends a Web Push notification to all active browser endpoints registered by the user.
 * Automatically de-registers 404/410 Gone expired endpoints.
 */
export async function sendUserPushNotification(
  userId: string,
  payload: PushNotificationPayload,
) {
  if (!ensureVapidConfigured()) {
    console.warn("[Web Push] Skipped push delivery: VAPID is not configured");
    return { sent: 0, failed: 0, reason: "VAPID_NOT_CONFIGURED" };
  }

  const userSubs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (userSubs.length === 0) {
    console.log(`[Web Push] User ${userId} has 0 registered push subscriptions`);
    return { sent: 0, failed: 0, reason: "NO_SUBSCRIPTIONS" };
  }

  let sent = 0;
  let failed = 0;

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "openbots-notification",
    data: payload.data,
  });

  await Promise.allSettled(
    userSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload,
          {
            TTL: 60 * 60 * 24, // 24 hours
          },
        );
        sent++;
      } catch (err: any) {
        failed++;
        // If subscription is expired or unsubscribed, remove from database
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          console.log(`Removing expired push subscription ${sub.id}`);
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id))
            .catch(() => {});
        } else {
          console.warn(`Failed to deliver push notification to ${sub.endpoint}:`, err?.message || err);
        }
      }
    }),
  );

  return { sent, failed };
}
