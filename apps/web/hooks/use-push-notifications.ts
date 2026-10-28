"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { getClient } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Wait for the service worker registration to reach the "activated" state.
 * Returns the active ServiceWorker.
 */
async function waitForSwActivation(
  reg: ServiceWorkerRegistration,
): Promise<ServiceWorker> {
  if (reg.active) return reg.active;

  const pending = reg.installing || reg.waiting;
  if (!pending) {
    // Fallback: wait for navigator.serviceWorker.ready which resolves on activation
    const readyReg = await navigator.serviceWorker.ready;
    if (readyReg.active) return readyReg.active;
    throw new Error("Service worker failed to activate.");
  }

  return new Promise<ServiceWorker>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Service worker activation timed out."));
    }, 10_000);

    pending.addEventListener("statechange", () => {
      if (pending.state === "activated") {
        clearTimeout(timeout);
        resolve(pending);
      } else if (pending.state === "redundant") {
        clearTimeout(timeout);
        reject(new Error("Service worker became redundant."));
      }
    });
  });
}

/**
 * Attempt pushManager.subscribe with retries.
 * On macOS Chrome/Brave the push service connection can lag behind browser
 * startup, causing a transient AbortError / "push service error". A short
 * retry loop (with back-off) resolves most cases without user intervention.
 */
async function subscribeWithRetry(
  reg: ServiceWorkerRegistration,
  applicationServerKey: Uint8Array,
  maxAttempts = 3,
): Promise<PushSubscription> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.name === "AbortError" ||
        err?.message?.toLowerCase().includes("push service error");
      if (!isTransient || attempt === maxAttempts) break;
      // Back off: 1s, 2s
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw lastError;
}

/**
 * Sync a local PushSubscription with the backend.
 * Fire-and-forget safe — never throws.
 */
async function syncSubscriptionToBackend(sub: PushSubscription) {
  const subJson = sub.toJSON();
  if (!sub.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return;

  try {
    const client = getClient();
    await client.api.notifications.subscribe.$post({
      json: {
        endpoint: sub.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
        userAgent: navigator.userAgent,
      },
    });
  } catch {
    // best-effort
  }
}

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check support on mount
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    ) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);

      if (sub) {
        syncSubscriptionToBackend(sub);
      }
    } catch (err) {
      console.warn("Failed to check push subscription:", err);
    }
  }, []);

  // Fetch VAPID public key from backend
  const { data: vapidData } = useQuery({
    queryKey: ["notifications", "public-key"],
    queryFn: async () => {
      const client = getClient();
      const res = await client.api.notifications["public-key"].$get();
      if (!res.ok) throw new Error("Failed to fetch VAPID key");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setIsLoading(true);

      if (!isSupported) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      const vapidKey =
        vapidData?.publicKey ||
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        throw new Error(
          "VAPID public key is not configured on the server. Please check your .env settings.",
        );
      }

      // 1. Request browser notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        throw new Error("Notification permission was denied.");
      }

      // 2. Register service worker and wait for it to be fully active
      const reg = await navigator.serviceWorker.register("/sw.js");
      await waitForSwActivation(reg);

      // 3. Check for an existing subscription
      const existingSub = await reg.pushManager.getSubscription();

      // 4. If there's already a valid subscription, re-use it — don't
      //    unsubscribe and re-subscribe, which destroys working state when
      //    the push service is temporarily unreachable on macOS.
      if (existingSub) {
        const existingJson = existingSub.toJSON();
        if (
          existingSub.endpoint &&
          existingJson.keys?.p256dh &&
          existingJson.keys?.auth
        ) {
          // Sync to backend and we're done
          const client = getClient();
          const res = await client.api.notifications.subscribe.$post({
            json: {
              endpoint: existingSub.endpoint,
              keys: {
                p256dh: existingJson.keys.p256dh,
                auth: existingJson.keys.auth,
              },
              userAgent: navigator.userAgent,
            },
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              (data as any)?.error ||
                "Failed to save push subscription on server.",
            );
          }

          setIsSubscribed(true);
          return true;
        }

        // Subscription exists but is malformed — clean it up
        try {
          await existingSub.unsubscribe();
        } catch {}
      }

      // 5. Create a fresh subscription with retry for transient push service errors
      const sub = await subscribeWithRetry(
        reg,
        urlBase64ToUint8Array(vapidKey),
      );

      const subJson = sub.toJSON();
      if (!sub.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid push subscription received from browser.");
      }

      // 6. Save subscription on backend
      const client = getClient();
      const res = await client.api.notifications.subscribe.$post({
        json: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          userAgent: navigator.userAgent,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.error || "Failed to save push subscription on server.");
      }

      setIsSubscribed(true);
      return true;
    },
    onError: (err: Error) => {
      let msg = err.message;
      if (err.name === "AbortError" || msg.includes("push service error")) {
        msg =
          "Browser push service error. If you are on Chrome/Brave on macOS, ensure OS Notifications are enabled in System Settings > Notifications, then fully quit and reopen the browser.";
      }
      console.error("[Push Subscribe]", err);
      setError(msg);
      setIsLoading(false);
    },
    onSuccess: () => {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setIsLoading(true);

      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        const client = getClient();
        await client.api.notifications.unsubscribe.$post({
          json: { endpoint },
        });
      }

      setIsSubscribed(false);
      return true;
    },
    onError: (err: Error) => {
      let msg = err.message;
      if (err.name === "AbortError" || msg.includes("push service error")) {
        msg =
          "Browser push service error. If you are on Chrome/Brave on macOS, ensure OS Notifications are enabled in System Settings > Notifications, then fully quit and reopen the browser.";
      }
      console.error("[Push Unsubscribe]", err);
      setError(msg);
      setIsLoading(false);
    },
    onSuccess: () => {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const sendTestNotification = useMutation({
    mutationFn: async () => {
      const client = getClient();
      const res = await client.api.notifications.test.$post();
      if (!res.ok) throw new Error("Failed to send test notification");
      return res.json();
    },
  });

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading: isLoading || subscribeMutation.isPending || unsubscribeMutation.isPending,
    error,
    subscribe: subscribeMutation.mutateAsync,
    unsubscribe: unsubscribeMutation.mutateAsync,
    sendTestNotification: sendTestNotification.mutateAsync,
    isTesting: sendTestNotification.isPending,
  };
}
