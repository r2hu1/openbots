import { Composio } from "@composio/core";
import { connections, db } from "@openbots/db";
import { and, desc, eq, ne } from "drizzle-orm";

export async function listConnections(userId: string) {
  const userConnections = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.userId, userId),
        ne(connections.provider, "composio"),
      ),
    )
    .orderBy(desc(connections.createdAt));

  // Verify pending/active connections against Composio's actual state
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (apiKey && userConnections.length > 0) {
    const composio = new Composio({ apiKey });
    try {
      const composioAccounts = await composio.connectedAccounts.list({
        userIds: [userId],
      });
      const activeAccountIds = new Set(
        (composioAccounts.items ?? [])
          .filter((a: any) => a.status === "ACTIVE")
          .map((a: any) => a.id),
      );

      for (const conn of userConnections) {
        const isActive = activeAccountIds.has(conn.externalAccountId);
        const shouldBeStatus = isActive ? "active" : "disconnected";

        if (conn.status !== shouldBeStatus) {
          await db
            .update(connections)
            .set({ status: shouldBeStatus, updatedAt: new Date() })
            .where(eq(connections.id, conn.id));
          (conn as any).status = shouldBeStatus;
        }
      }
    } catch {
      // If Composio is unreachable, return cached DB state
    }
  }

  return { connections: userConnections };
}

export async function getConnection(id: string, userId: string) {
  const [connection] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, id), eq(connections.userId, userId)));

  if (!connection) {
    return null;
  }

  return { connection };
}

export async function createConnection(
  userId: string,
  data: { provider: string; externalAccountId: string; metadata?: any },
) {
  const [connection] = await db
    .insert(connections)
    .values({
      userId,
      provider: data.provider,
      externalAccountId: data.externalAccountId,
      status: "active",
      metadata: data.metadata ?? null,
    })
    .onConflictDoUpdate({
      target: [
        connections.userId,
        connections.provider,
        connections.externalAccountId,
      ],
      set: {
        status: "active",
        metadata: data.metadata ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return { connection };
}

export async function deleteConnection(id: string, userId: string) {
  const [deleted] = await db
    .delete(connections)
    .where(and(eq(connections.id, id), eq(connections.userId, userId)))
    .returning();

  if (!deleted) {
    return null;
  }

  return { connection: deleted };
}

export async function initiateConnection(userId: string, appName: string) {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is required for initiating connections");
  }

  const composio = new Composio({ apiKey });

  // 1. Find the auth config for the toolkit
  let authConfigId: string | null = null;

  try {
    const listRes = await composio.authConfigs.list({
      toolkit: appName.toLowerCase(),
      showDisabled: false,
    });
    const configs = listRes.items || [];
    const active =
      configs.find((c) => c.status === "ENABLED") ?? configs[0];
    if (active?.id) {
      authConfigId = active.id;
    }
  } catch {
    // If authConfigs.list fails, try toolkit metadata
  }

  if (!authConfigId) {
    try {
      const toolkit = (await composio.toolkits.get(appName.toLowerCase())) as any;
      const authConfigs: any[] =
        toolkit.authConfigDetails?.items ?? toolkit.authConfigDetails ?? [];
      const isNoAuth =
        toolkit.noAuth ||
        toolkit.authScheme === "NO_AUTH" ||
        authConfigs.some((c: any) => c.mode === "NO_AUTH");

      if (isNoAuth) {
        await db
          .insert(connections)
          .values({
            userId,
            provider: appName.toLowerCase(),
            externalAccountId: `no_auth_${appName.toLowerCase()}`,
            status: "active",
            metadata: { noAuth: true, activatedAt: new Date().toISOString() },
          })
          .onConflictDoUpdate({
            target: [
              connections.userId,
              connections.provider,
              connections.externalAccountId,
            ],
            set: {
              status: "active",
              metadata: { noAuth: true, activatedAt: new Date().toISOString() },
              updatedAt: new Date(),
            },
          });

        return { redirectUrl: "/connections" };
      }

      const primaryConfig =
        authConfigs.find((c: any) => c.status === "ENABLED") ?? authConfigs[0];
      if (primaryConfig?.id) {
        authConfigId = primaryConfig.id;
      }
    } catch {
      // Continue to link call if not resolved
    }
  }

  if (!authConfigId) {
    throw new Error(
      `No active authentication configuration found for ${appName}. Please ensure ${appName} integration is enabled in Composio.`,
    );
  }

  // 2. Link using POST /api/v3/connected_accounts/link
  const linkResult = await composio.connectedAccounts.link(userId, authConfigId);
  const redirectUrl = linkResult.redirectUrl ?? null;
  const connectionRequestId = linkResult.id ?? null;

  if (!redirectUrl) {
    throw new Error(
      `No redirect URL returned for ${appName}. The app may not support OAuth or may already be connected.`,
    );
  }

  // Store as 'disconnected' until OAuth callback confirms the connection
  await db
    .insert(connections)
    .values({
      userId,
      provider: appName.toLowerCase(),
      externalAccountId: connectionRequestId ?? `${appName.toLowerCase()}_${Date.now()}`,
      status: "disconnected",
      metadata: { initiatedAt: new Date().toISOString() },
    })
    .onConflictDoUpdate({
      target: [
        connections.userId,
        connections.provider,
        connections.externalAccountId,
      ],
      set: {
        status: "disconnected",
        metadata: { initiatedAt: new Date().toISOString() },
        updatedAt: new Date(),
      },
    });

  return { redirectUrl };
}
