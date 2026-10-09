import {
  app,
  registerDirectRunCanceller,
  registerDirectRunExecutor,
} from "@openbots/api-contract";
import { abortActiveRun, executeAgentRun } from "./agent/execute.js";

// Register direct execution so interactive runs stream immediately from the API server
registerDirectRunExecutor(async (runId: string) => {
  return await executeAgentRun(runId);
});

registerDirectRunCanceller((runId: string, reason?: string) => {
  abortActiveRun(runId, reason);
});

const port = parseInt(process.env.PORT ?? "3001", 10);

console.log(`API server starting on port ${port}`);

export default app;
