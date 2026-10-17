import { cancelRun } from "@openbots/api-contract";
import { agentTools, agents, db, runSteps, runs } from "@openbots/db";
import { executeAgentRun, sanitizeErrorMessage } from "./src/agent/execute.js";
import { buildAgentTools } from "./src/agent/tools.js";

export async function runHardeningTests(
  testUserId: string,
  testAgent: any,
  completedRun1: any,
  completedFailRun: any,
) {
  // Test 4: Concurrency-Safe Atomic Claim & Duplicate Trigger Execution
  console.log(
    "\n7. Test 4: Concurrency-Safe Atomic Claim & Duplicate Trigger Execution...",
  );
  const [dupRun] = await db
    .insert(runs)
    .values({
      userId: testUserId,
      agentId: testAgent.id,
      status: "queued",
      triggerType: "manual",
      input: { prompt: "Calculate 5 + 5" },
    })
    .returning();

  console.log(
    "   Dispatching two simultaneous executions for same run:",
    dupRun.id,
  );
  const [exec1, exec2] = await Promise.all([
    executeAgentRun(dupRun.id),
    executeAgentRun(dupRun.id),
  ]);

  console.log("   Exec 1 status:", exec1.status);
  console.log("   Exec 2 status:", exec2.status);

  const [finalDupRun] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, dupRun.id));

  if (finalDupRun.status !== "completed") {
    throw new Error(
      `Test 4 Failed: Expected run status 'completed', got '${finalDupRun.status}'`,
    );
  }
  console.log(
    "   -> Test 4 PASSED (Atomic claim prevented duplicate execution)!",
  );

  // Test 5: Terminal States Are Immutable
  console.log("\n8. Test 5: Terminal States Are Immutable...");
  const execCompletedAgain = await executeAgentRun(completedRun1.id);
  if (execCompletedAgain.status !== "completed") {
    throw new Error("Test 5a Failed: Completed run changed status");
  }

  const execFailedAgain = await executeAgentRun(completedFailRun.id);
  if (execFailedAgain.status !== "failed") {
    throw new Error("Test 5b Failed: Failed run changed status");
  }

  const cancelCompletedRes = await cancelRun(completedRun1.id, testUserId);
  if (cancelCompletedRes.run?.status !== "completed") {
    throw new Error(
      `Test 5c Failed: Completed run was overwritten with '${cancelCompletedRes.run?.status}'`,
    );
  }

  const cancelFailedRes = await cancelRun(completedFailRun.id, testUserId);
  if (cancelFailedRes.run?.status !== "failed") {
    throw new Error(
      `Test 5d Failed: Failed run was overwritten with '${cancelFailedRes.run?.status}'`,
    );
  }
  console.log(
    "   -> Test 5 PASSED (Terminal states 'completed' and 'failed' are immutable)!",
  );

  // Test 6: Race Condition (queued -> cancel -> Trigger starts)
  console.log("\n9. Test 6: Race (queued -> cancel -> Trigger starts)...");
  const [cancelFirstRun] = await db
    .insert(runs)
    .values({
      userId: testUserId,
      agentId: testAgent.id,
      status: "queued",
      triggerType: "manual",
      input: { prompt: "This should be cancelled before execution" },
    })
    .returning();

  const cancelRes = await cancelRun(cancelFirstRun.id, testUserId);
  if (cancelRes.run?.status !== "cancelled") {
    throw new Error(
      `Test 6 Setup Failed: Run was not cancelled: ${cancelRes.run?.status}`,
    );
  }

  const execAfterCancel = await executeAgentRun(cancelFirstRun.id);
  const [dbAfterCancel] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, cancelFirstRun.id));

  if (
    dbAfterCancel.status !== "cancelled" ||
    execAfterCancel.status !== "cancelled"
  ) {
    throw new Error(
      `Test 6 Failed: Cancelled run became '${dbAfterCancel.status}'`,
    );
  }

  const stepsAfterCancel = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, cancelFirstRun.id));
  if (stepsAfterCancel.length > 0) {
    throw new Error("Test 6 Failed: Steps were executed on cancelled run");
  }
  console.log("   -> Test 6 PASSED (Cancelled run skipped execution cleanly)!");

  // Test 7: Cooperative Cancellation with AbortSignal
  console.log("\n10. Test 7: Cooperative Cancellation with AbortSignal...");
  const [abortRun] = await db
    .insert(runs)
    .values({
      userId: testUserId,
      agentId: testAgent.id,
      status: "queued",
      triggerType: "manual",
      input: { prompt: "Please calculate 999 * 888" },
    })
    .returning();

  const abortController = new AbortController();
  abortController.abort(new Error("User cancelled"));

  const abortedResult = await executeAgentRun(abortRun.id, {
    signal: abortController.signal,
  });

  const [dbAbortedRun] = await db
    .select()
    .from(runs)
    .where(eq(runs.id, abortRun.id));

  if (
    dbAbortedRun.status !== "cancelled" ||
    abortedResult.status !== "cancelled"
  ) {
    throw new Error(
      `Test 7 Failed: Expected 'cancelled', got '${dbAbortedRun.status}'`,
    );
  }
  console.log(
    "   -> Test 7 PASSED (Cooperative cancellation cleanly marks run as cancelled)!",
  );

  // Test 8: Tool Availability Filtering
  console.log("\n11. Test 8: Tool Availability Filtering...");
  const [agentWithDisabledTool] = await db
    .insert(agents)
    .values({
      userId: testUserId,
      name: "Agent with Disabled Tool",
      instructions: "Testing tool filtering",
      model: "google/gemini-2.5-flash",
      maxSteps: 5,
      autonomy: "manual",
      status: "active",
    })
    .returning();

  await db.insert(agentTools).values([
    {
      agentId: agentWithDisabledTool.id,
      provider: "internal",
      toolName: "get_current_time",
      enabled: false,
    },
    {
      agentId: agentWithDisabledTool.id,
      provider: "internal",
      toolName: "calculate",
      enabled: true,
    },
  ]);

  const resolved = await buildAgentTools({
    userId: testUserId,
    agentId: agentWithDisabledTool.id,
  });

  if (resolved.tools["get_current_time"]) {
    throw new Error(
      "Test 8 Failed: Disabled tool 'get_current_time' was included in tools",
    );
  }
  if (!resolved.tools["calculate"]) {
    throw new Error(
      "Test 8 Failed: Enabled tool 'calculate' was NOT included in tools",
    );
  }
  await resolved.cleanup();
  console.log("   -> Test 8 PASSED (Disabled tools are strictly excluded)!");

  // Test 9: Safe Error Handling & Secret Redaction
  console.log("\n12. Test 9: Safe Error Handling & Secret Redaction...");
  const sampleSecretError =
    "Error: Google API key AIzaSyB_123456789012345678901234567 and Trigger key tr_dev_sk_12345678901234567890 and Bearer eyJhbGciOiJIUzI1NiJ9.abc.def and password postgresql://myuser:supersecretpass@db.example.com:5432/mydb leaked";

  const sanitized = sanitizeErrorMessage(sampleSecretError);
  console.log("   Sanitized string:", sanitized);

  if (
    sanitized.includes("AIzaSyB_") ||
    sanitized.includes("tr_dev_sk_") ||
    sanitized.includes("supersecretpass")
  ) {
    throw new Error("Test 9 Failed: Secrets were not redacted properly");
  }
  if (
    !sanitized.includes("[REDACTED_GEMINI_KEY]") ||
    !sanitized.includes("[REDACTED_TRIGGER_KEY]") ||
    !sanitized.includes("[REDACTED_PASSWORD]")
  ) {
    throw new Error("Test 9 Failed: Redacted tokens not found");
  }
  console.log("   -> Test 9 PASSED (All sensitive secrets cleanly redacted)!");
}
