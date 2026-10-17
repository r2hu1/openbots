import { cancelRun } from "@openbots/api-contract";
import { agentTools, agents, db, runSteps, runs, user } from "@openbots/db";
import { asc, eq } from "drizzle-orm";
import { executeAgentRun, sanitizeErrorMessage } from "./src/agent/execute.js";
import { buildAgentTools } from "./src/agent/tools.js";

export async function setupTestFixtures() {
  const testUserId = "test-user-e2e-1";
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, testUserId));
  if (!existingUser) {
    await db.insert(user).values({
      id: testUserId,
      name: "Test User",
      email: "e2e-tester@openbots.dev",
      emailVerified: true,
    });
    console.log("   Created user:", testUserId);
  } else {
    console.log("   Reusing user:", testUserId);
  }

  const [testAgent] = await db
    .insert(agents)
    .values({
      userId: testUserId,
      name: "Test Assistant",
      description: "E2E Test Assistant Agent",
      instructions:
        "You are a helpful assistant. Use the available tools when they are useful.",
      model: "google/gemini-2.5-flash",
      maxSteps: 10,
      autonomy: "manual",
      status: "active",
    })
    .returning();
  console.log("   Created agent:", testAgent.id, `(${testAgent.name})`);

  await db.insert(agentTools).values([
    {
      agentId: testAgent.id,
      provider: "internal",
      toolName: "get_current_time",
      enabled: true,
    },
    {
      agentId: testAgent.id,
      provider: "internal",
      toolName: "calculate",
      enabled: true,
    },
  ]);
  console.log("   Enabled get_current_time and calculate tools for agent.");

  return { testUserId, testAgent };
}

export async function runWithRetry(runId: string, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await executeAgentRun(runId);
    } catch (err: any) {
      if (
        err.message?.includes("Quota exceeded") ||
        err.message?.includes("high demand") ||
        err.message?.includes("429")
      ) {
        console.warn(
          `   Notice: Hit temporary rate limit/quota, waiting 25s before retry (attempt ${attempt}/${maxAttempts})...`,
        );
        await new Promise((r) => setTimeout(r, 25000));
        await db
          .update(runs)
          .set({ status: "queued", error: null })
          .where(eq(runs.id, runId));
        continue;
      }
      throw err;
    }
  }
  return await executeAgentRun(runId);
}
