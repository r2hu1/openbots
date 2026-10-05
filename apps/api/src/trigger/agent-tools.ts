import { task } from "@trigger.dev/sdk";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

const execAsync = promisify(exec);

// Redact any env var value from output, so `env` / `cat /proc/*/environ` can't leak secrets into your DB
function redact(s?: string) {
  let out = (s ?? "").slice(0, 20000);
  for (const v of Object.values(process.env)) {
    if (v && v.length >= 8) out = out.split(v).join("[REDACTED]");
  }
  return out;
}

export async function runBash(p: {
  command: string;
  cwd?: string;
  timeoutMs: number;
}) {
  const workdir = p.cwd ?? (await mkdtemp(join(tmpdir(), "agent-")));
  try {
    const { stdout, stderr } = await execAsync(p.command, {
      shell: "/bin/bash",
      cwd: workdir,
      timeout: p.timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
      env: { PATH: process.env.PATH, HOME: workdir },
    });
    return { exitCode: 0, stdout: redact(stdout), stderr: redact(stderr) };
  } catch (err: any) {
    return {
      exitCode: typeof err.code === "number" ? err.code : 1,
      stdout: redact(err.stdout),
      stderr: redact(err.stderr),
      error: err.killed ? "Command timed out" : redact(err.message),
    };
  }
}

export const bashTask = task({
  id: "tool-bash",
  maxDuration: 300,
  retry: { maxAttempts: 1 }, // never retry: commands have side effects
  run: async (p: { command: string; cwd?: string; timeoutMs: number }) => {
    return await runBash(p);
  },
});

export async function runExecuteCode({ code }: { code: string }) {
  const logs: string[] = [];
  const sandbox = {
    console: {
      log: (...a: unknown[]) => logs.push(a.map(String).join(" ")),
    },
  };
  try {
    const result = vm.runInNewContext(`(${code})`, sandbox, {
      timeout: 5000,
    });
    return {
      success: true,
      result:
        result === undefined ? "undefined" : JSON.parse(JSON.stringify(result)),
      logs,
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err), logs };
  }
}

export const executeCodeTask = task({
  id: "tool-execute-code",
  maxDuration: 60,
  retry: { maxAttempts: 1 },
  run: async ({ code }: { code: string }) => {
    return await runExecuteCode({ code });
  },
});
