import { cors } from "hono/cors";

function isOriginAllowed(origin: string): boolean {
  if (
    origin === "http://localhost:3000" ||
    origin === "http://localhost:3001" ||
    origin === "http://127.0.0.1:3000" ||
    origin === "http://127.0.0.1:3001"
  ) {
    return true;
  }

  const appUrl = process.env.APP_URL;
  if (appUrl && (origin === appUrl || origin === appUrl.replace(/\/$/, ""))) {
    return true;
  }

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (
    publicAppUrl &&
    (origin === publicAppUrl || origin === publicAppUrl.replace(/\/$/, ""))
  ) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app")) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return null;
    return isOriginAllowed(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Cookie", "x-user-id"],
  exposeHeaders: [
    "Content-Length",
    "Set-Cookie",
    "set-auth-token",
    "Set-Auth-Token",
  ],
  credentials: true,
  maxAge: 86400,
});
