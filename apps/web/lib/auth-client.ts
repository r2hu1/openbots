import { createAuthClient } from "better-auth/react"

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => (typeof window !== "undefined" ? localStorage.getItem("bearer_token") || "" : ""),
    },
    onSuccess: (ctx) => {
      if (typeof window === "undefined") return
      const authToken = ctx.response.headers.get("set-auth-token")
      if (authToken) {
        localStorage.setItem("bearer_token", authToken)
      }
    },
  },
})

export const { useSession, signIn, signUp } = authClient

export const signOut = async () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("bearer_token")
  }
  return await authClient.signOut()
}
