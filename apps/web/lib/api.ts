import { createClient } from "@openbots/api-client";

let clientInstance: ReturnType<typeof createClient> | null = null;

export function getClient() {
  if (!clientInstance) {
    clientInstance = createClient(undefined, {
      init: {
        credentials: "include",
      },
      headers: () => {
        const headers: Record<string, string> = {};
        if (typeof window !== "undefined") {
          const token =
            localStorage.getItem("bearer_token") ||
            localStorage.getItem("better-auth_token");
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        }
        return headers;
      },
    });
  }
  return clientInstance;
}
