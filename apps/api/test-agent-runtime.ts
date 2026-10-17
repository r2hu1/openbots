import { agents, db, runSteps, runs } from "@openbots/db";
import { asc, eq } from "drizzle-orm";
import { executeAgentRun } from "./src/agent/execute.js";
import { runHardeningTests } from "./test-hardening.js";
import { runWithRetry, setupTestFixtures } from "./test-helpers.js";

async function main() {
  console.log(
    "=== Starting OpenBots Agent Runtime E2E & Hardening Tests ===\n",
  );

  console.log("1. Setting up test user & agent...");
  const { testUserId, testAgent } = await setupTestFixtures();

  // Test 1: Single tool call — "What time is it?"
  console.log("\n4. Test 1: 'What time is it?' (Single tool loop)...");
  const [run1] = await db
    .insert(runs)
    .values({
      userId: testUserId,
      agentId: testAgent.id,
      status: "queued",
      triggerType: "manual",
      input: { prompt: "What time is it?" },
    })
    .returning();
  console.log("   Queued run 1:", run1.id);

  console.log("   Executing agent run through ToolLoopAgent...");
  await runWithRetry(run1.id);

  const [completedRun1] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, run1.id));
  const steps1 = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, run1.id))
    .orderBy(asc(runSteps.stepNumber));

  console.log("   Run 1 Status:", completedRun1.status);
  console.log("   Run 1 Output:", JSON.stringify(completedRun1.output));
  console.log(`   Run 1 Steps recorded (${steps1.length}):`);
  for (const s of steps1) {
    console.log(
      `     Step ${s.stepNumber} [${s.type}] (${s.status})${s.toolName ? ` tool=${s.toolName}` : ""}`,
    );
  }

  if (completedRun1.status !== "completed") {
    throw new Error(`Test 1 Failed: Run status is ${completedRun1.status}`);
  }
  const hasTimeToolCall = steps1.some(
    (s) => s.type === "tool" && s.toolName === "get_current_time",
  );
  if (!hasTimeToolCall) {
    throw new Error("Test 1 Failed: get_current_time was not invoked");
  }
  console.log("   -> Test 1 PASSED!");

  await new Promise((r) => setTimeout(r, 4000));

  // Test 2: Multi-step tool calls
  console.log("\n5. Test 2: Multi-step tool interaction...");
  const [run2] = await db
    .insert(runs)
    .values({
      userId: testUserId,
      agentId: testAgent.id,
      status: "queued",
      triggerType: "manual",
      input: {
        prompt:
          "Please calculate 125 * 8, and also tell me what time it is right now.",
      },
    })
    .returning();
  console.log("   Queued run 2:", run2.id);

  await runWithRetry(run2.id);

  const [completedRun2] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, run2.id));
  const steps2 = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, run2.id))
    .orderBy(asc(runSteps.stepNumber));

  console.log("   Run 2 Status:", completedRun2.status);
  console.log("   Run 2 Output:", JSON.stringify(completedRun2.output));
  console.log(`   Run 2 Steps recorded (${steps2.length}):`);
  for (const s of steps2) {
    console.log(
      `     Step ${s.stepNumber} [${s.type}] (${s.status})${s.toolName ? ` tool=${s.toolName}` : ""}`,
    );
  }

  if (completedRun2.status !== "completed") {
    throw new Error(`Test 2 Failed: Run status is ${completedRun2.status}`);
  }
  const toolSteps = steps2.filter((s) => s.type === "tool");
  console.log(
    `   Tool calls executed: ${toolSteps.map((s) => s.toolName).join(", ")}`,
  );
  console.log("   -> Test 2 PASSED!");

  // Test 3: Failure handling (unsupported autonomy)
  console.log("\n6. Test 3: Failure handling (unsupported autonomy)...");
  const [failAgent] = await db
    .insert(agents)
    .values({
      userId: testUserId,
      name: "Autonomous Agent (Unsupported)",
      instructions: "This should fail because autonomy mode is autonomous.",
      model: "google/gemini-2.5-flash",
      maxSteps: 10,
      autonomy: "autonomous",
      status: "active",
    })
    .returning();

  const [failRun] = await db
    .insert(runs)
    .values({
      userId: testUserId,
      agentId: failAgent.id,
      status: "queued",
      triggerType: "manual",
      input: { prompt: "Hello" },
    })
    .returning();

  try {
    await executeAgentRun(failRun.id);
  } catch (err: any) {
    console.log("   Caught expected error:", err.message);
  }

  const [completedFailRun] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, failRun.id));
  console.log("   Fail Run Status:", completedFailRun.status);
  console.log("   Fail Run Error:", completedFailRun.error);

  if (completedFailRun.status !== "failed") {
    throw new Error(
      `Test 3 Failed: expected 'failed', got '${completedFailRun.status}'`,
    );
  }
  console.log("   -> Test 3 PASSED!");

  await new Promise((r) => setTimeout(r, 4000));

  await runHardeningTests(testUserId, testAgent, completedRun1, completedFailRun);

  console.log("\n=== ALL E2E AND HARDENING TESTS PASSED SUCCESSFULLY! ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nE2E Test Run Failed with Error:", err);
  process.exit(1);
});
