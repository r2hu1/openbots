import { db } from "@openbots/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer } from "better-auth/plugins/bearer"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
  },
  user: {
    changeEmail: {
      enabled: true,
    },
    deleteUser: {
      enabled: true,
    },
  },
  plugins: [bearer()],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://openbots-r2hu1-personal.vercel.app",
    "https://openbots-api-private.vercel.app",
    "https://*.vercel.app",
    ...(process.env.APP_URL ? [process.env.APP_URL.replace(/\/$/, "")] : []),
    ...(process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")]
      : []),
    ...(process.env.NEXT_PUBLIC_API_URL
      ? [process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")]
      : []),
  ],
})

export type Auth = typeof auth
