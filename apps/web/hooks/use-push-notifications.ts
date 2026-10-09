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

      // If browser already has a subscription and user is signed in, guarantee backend is synced
      if (sub) {
        const subJson = sub.toJSON();
        if (sub.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
          const client = getClient();
          client.api.notifications.subscribe
            .$post({
              json: {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: subJson.keys.p256dh,
                  auth: subJson.keys.auth,
                },
                userAgent: navigator.userAgent,
              },
            })
            .catch(() => {});
        }
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

      // 2. Register service worker if not already registered
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 3. Subscribe with PushManager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      if (!sub.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid push subscription received from browser.");
      }

      // 4. Save subscription on backend
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
      setError(err.message);
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

        // Inform backend
        const client = getClient();
        await client.api.notifications.unsubscribe.$post({
          json: { endpoint },
        });
      }

      setIsSubscribed(false);
      return true;
    },
    onError: (err: Error) => {
      setError(err.message);
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
