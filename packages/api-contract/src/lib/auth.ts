import { db } from "@openbots/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

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
  trustedOrigins: [
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.APP_URL!,
  ],
})

export type Auth = typeof auth
