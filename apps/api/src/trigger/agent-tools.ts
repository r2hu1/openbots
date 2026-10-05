import { task } from "@trigger.dev/sdk"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import vm from "node:vm"

const execAsync = promisify(exec)
const cap = (s?: string) => (s ?? "").slice(0, 20000)

export const bashTask = task({
  id: "tool-bash",
  maxDuration: 300,
  retry: { maxAttempts: 1 }, // never retry: commands have side effects
  run: async (p: { command: string; cwd?: string; timeoutMs: number }) => {
    const workdir = p.cwd ?? (await mkdtemp(join(tmpdir(), "agent-")))
    try {
      const { stdout, stderr } = await execAsync(p.command, {
        shell: "/bin/bash",
        cwd: workdir,
        timeout: p.timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
        env: { PATH: process.env.PATH, HOME: workdir },
      })
      return {
        exitCode: 0,
        stdout: cap(stdout),
        stderr: cap(stderr),
        cwd: workdir,
      }
    } catch (err: any) {
      return {
        exitCode: typeof err.code === "number" ? err.code : 1,
        stdout: cap(err.stdout),
        stderr: cap(err.stderr),
        error: err.killed ? "Command timed out" : err.message,
        cwd: workdir,
      }
    }
  },
})

export const executeCodeTask = task({
  id: "tool-execute-code",
  maxDuration: 60,
  retry: { maxAttempts: 1 },
  run: async ({ code }: { code: string }) => {
    try {
      const result = vm.runInNewContext(`(${code})`, Object.create(null), {
        timeout: 5000,
      })
      return {
        success: true,
        result:
          result === undefined
            ? "undefined"
            : JSON.parse(JSON.stringify(result)),
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Code evaluation failed",
      }
    }
  },
})
