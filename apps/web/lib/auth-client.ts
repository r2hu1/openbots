import { createAuthClient } from "better-auth/react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () =>
        typeof window !== "undefined"
          ? localStorage.getItem("bearer_token") || ""
          : "",
    },
    onSuccess: (ctx) => {
      if (typeof window === "undefined") return;
      const authToken = ctx.response.headers.get("set-auth-token");
      if (authToken) {
        localStorage.setItem("bearer_token", authToken);
      }
    },
  },
});

export const useSession: typeof authClient.useSession = authClient.useSession;
export const signIn: typeof authClient.signIn = authClient.signIn;
export const signUp: typeof authClient.signUp = authClient.signUp;

export const signOut = async () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("bearer_token");
  }
  return await authClient.signOut();
};
