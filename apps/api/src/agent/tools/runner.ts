import { tasks } from "@trigger.dev/sdk";
import { runBash, runExecuteCode } from "../../trigger/agent-tools.js";

export async function runTool(id: string, payload: unknown) {
  try {
    // Inside a Trigger task: checkpoints the parent, cancellation cascades
    const result = await tasks.triggerAndWait(id, payload as any);
    if (!result.ok) {
      return { error: `Task ${id} failed`, details: String(result.error) };
    }
    return result.output;
  } catch (err: any) {
    if (!String(err?.message).includes("can only be used from inside a task")) {
      return { error: err?.message ?? "Tool task failed" };
    }
  }

  // Outside a task (API direct execution): execute directly in-process without polling
  if (id === "tool-bash") {
    return await runBash(payload as any);
  }
  if (id === "tool-execute-code") {
    return await runExecuteCode(payload as any);
  }
  return { error: `Unknown tool task ${id}` };
}
