import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { getApiKeyForModel, runEventHub } from "@openbots/api-contract"
import { agents, connections, db, messages, runSteps, runs } from "@openbots/db"
import { stepCountIs, ToolLoopAgent } from "ai"
import { and, asc, eq, inArray, ne } from "drizzle-orm"
import { buildAgentTools } from "./tools.js"
import { ARTIFACT_PROMPT } from "./artifacts/prompt.js"

/**
 * Pre-fetches an image URL using native fetch and returns an AI SDK image part
 * with raw bytes. This avoids AI SDK's internal download logic which requires
 * `undici` — a module unavailable in esbuild-bundled Node deployments.
 */
async function fetchImagePart(imgUrl: string) {
  try {
    const res = await fetch(imgUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    const mimeType = res.headers.get("content-type") || "image/png"
    return {
      type: "image" as const,
      image: new Uint8Array(buf),
      mimeType,
    }
  } catch {
    // Last resort: pass the URL and let AI SDK attempt its own download.
    return { type: "image" as const, image: new URL(imgUrl) }
  }
}

async function resolveModel(userId: string, modelName: string) {
  const apiKey = await getApiKeyForModel(userId, modelName)
  const normalized = modelName.trim()

  // 1. Google Gemini
  if (
    normalized.startsWith("google/") ||
    normalized.startsWith("gemini-") ||
    normalized === "default"
  ) {
    const key =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!key) {
      throw new Error(
        "Google API Key is not configured. Please add your Gemini API key in Settings > API Keys."
      )
    }
    const client = createGoogleGenerativeAI({ apiKey: key })
    const cleanId = normalized.replace("google/", "")
    return client(cleanId || "gemini-2.5-flash")
  }

  // 2. OpenAI
  if (normalized.startsWith("openai/")) {
    const key = apiKey || process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error(
        "OpenAI API Key is not configured. Please add your OpenAI API key in Settings > API Keys."
      )
    }
    const client = createOpenAI({ apiKey: key })
    return client(normalized.replace("openai/", ""))
  }

  // 3. Anthropic
  if (normalized.startsWith("anthropic/")) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error(
        "Anthropic API Key is not configured. Please add your Anthropic API key in Settings > API Keys."
      )
    }
    const client = createAnthropic({ apiKey: key })
    return client(normalized.replace("anthropic/", ""))
  }

  // 4. DeepSeek (OpenAI-compatible)
  if (normalized.startsWith("deepseek/")) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY
    if (!key) {
      throw new Error(
        "DeepSeek API Key is not configured. Please add your DeepSeek API key in Settings > API Keys."
      )
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://api.deepseek.com/v1",
    })
    return client(normalized.replace("deepseek/", ""))
  }

  // 5. Groq (OpenAI-compatible)
  if (normalized.startsWith("groq/")) {
    const key = apiKey || process.env.GROQ_API_KEY
    if (!key) {
      throw new Error(
        "Groq API Key is not configured. Please add your Groq API key in Settings > API Keys."
      )
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://api.groq.com/openai/v1",
    })
    return client(normalized.replace("groq/", ""))
  }

  // 6. xAI Grok (OpenAI-compatible)
  if (normalized.startsWith("xai/") || normalized.startsWith("grok/")) {
    const key = apiKey || process.env.XAI_API_KEY
    if (!key) {
      throw new Error(
        "xAI API Key is not configured. Please add your xAI API key in Settings > API Keys."
      )
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://api.x.ai/v1",
    })
    return client(normalized.replace("xai/", "").replace("grok/", ""))
  }

  // 7. OpenRouter (OpenAI-compatible)
  if (normalized.startsWith("openrouter/")) {
    const key = apiKey || process.env.OPENROUTER_API_KEY
    if (!key) {
      throw new Error(
        "OpenRouter API Key is not configured. Please add your OpenRouter API key in Settings > API Keys."
      )
    }
    const client = createOpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
    })
    return client(normalized.replace("openrouter/", ""))
  }

  // Fallback to Google Gemini
  const key =
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) {
    throw new Error(
      "No API key configured for model. Please configure your API key in Settings > API Keys."
    )
  }
  const client = createGoogleGenerativeAI({ apiKey: key })
  return client("gemini-2.5-flash")
}

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error during execution"
  const rawMessage = error instanceof Error ? error.message : String(error)
  // Redact potential API keys, connection strings, and secrets
  return rawMessage
    .replace(/AIzaSy[a-zA-Z0-9_-]{20,}/g, "[REDACTED_GEMINI_KEY]")
    .replace(/tr_(dev|prod)_[a-zA-Z0-9_-]{20,}/g, "[REDACTED_TRIGGER_KEY]")
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(
      /postgres(ql)?:\/\/[^:]+:([^@]+)@/gi,
      "postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@"
    )
    .replace(
      /(api[_-]?key|token|secret|password)\s*[:=]\s*['"][^'"]+['"]/gi,
      "$1=[REDACTED]"
    )
}

export async function executeAgentRun(
  runId: string,
  options?: { signal?: AbortSignal }
) {
  // If already aborted before execution start, transition directly to cancelled
  if (options?.signal?.aborted) {
    const [cancelledRun] = await db
      .update(runs)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(
        and(eq(runs.id, runId), inArray(runs.status, ["queued", "running"]))
      )
      .returning()

    if (cancelledRun) return cancelledRun
    const [existing] = await db.select().from(runs).where(eq(runs.id, runId))
    return existing ?? { id: runId, status: "cancelled" }
  }

  // 1. Concurrency-safe atomic claim from queued -> running
  const [claimedRun] = await db
    .update(runs)
    .set({
      status: "running",
      startedAt: new Date(),
    })
    .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
    .returning()

  if (!claimedRun) {
    // Run was already claimed, cancelled, or finished by another worker/request
    const [existingRun] = await db.select().from(runs).where(eq(runs.id, runId))

    if (!existingRun) {
      throw new Error(`Run not found: ${runId}`)
    }

    // Terminal states (completed, failed, cancelled) or active running state:
    // Do NOT start another model/tool loop.
    return existingRun
  }

  const runRecord = claimedRun

  const [agentRecord] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, runRecord.agentId))

  if (!agentRecord) {
    const errorMsg = `Agent not found for run ${runId}`
    await db
      .update(runs)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")))
    throw new Error(errorMsg)
  }

  // Validate agent ownership
  if (agentRecord.userId !== runRecord.userId) {
    const errorMsg = "Run owner does not match agent owner"
    await db
      .update(runs)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")))
    throw new Error(errorMsg)
  }

  // Validate autonomy: only manual is currently supported
  if (agentRecord.autonomy !== "manual") {
    const errorMsg = `Unsupported autonomy mode '${agentRecord.autonomy}'. Currently only 'manual' is supported.`
    await db
      .update(runs)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")))
    throw new Error(errorMsg)
  }

  // Set up cooperative AbortController
  const abortController = new AbortController()
  if (options?.signal) {
    if (options.signal.aborted) {
      abortController.abort(options.signal.reason)
    } else {
      options.signal.addEventListener(
        "abort",
        () => abortController.abort(options.signal?.reason),
        { once: true }
      )
    }
  }

  let resolvedTools: Awaited<ReturnType<typeof buildAgentTools>> | null = null

  try {
    // Check if cancellation occurred before tool setup
    if (abortController.signal.aborted) {
      const [cancelledRun] = await db
        .update(runs)
        .set({
          status: "cancelled",
          completedAt: new Date(),
        })
        .where(and(eq(runs.id, runId), eq(runs.status, "running")))
        .returning()
      const [current] = await db.select().from(runs).where(eq(runs.id, runId))
      return cancelledRun ?? current ?? runRecord
    }

    // Clear any previous partial steps if this run is being retried
    await db.delete(runSteps).where(eq(runSteps.runId, runId))

    // Parallelize preparation: model resolution, tool resolution, conversation message loading, and connection queries concurrently
    const [resolvedToolsResult, historyMessages, activeConnections, model] =
      await Promise.all([
        buildAgentTools({
          userId: runRecord.userId,
          agentId: agentRecord.id,
          conversationId: runRecord.conversationId,
        }),
        runRecord.conversationId
          ? db
              .select()
              .from(messages)
              .where(eq(messages.conversationId, runRecord.conversationId))
              .orderBy(asc(messages.createdAt))
          : Promise.resolve([]),
        db
          .select({ provider: connections.provider })
          .from(connections)
          .where(
            and(
              eq(connections.userId, runRecord.userId),
              eq(connections.status, "active"),
              ne(connections.provider, "composio")
            )
          ),
        resolveModel(runRecord.userId, agentRecord.model),
      ])

    resolvedTools = resolvedToolsResult

    // Prepare conversation messages (supporting multimodal user inputs)
    const inputMessages: Array<any> = []

    for (const m of historyMessages) {
      if (m.role === "user") {
        const contentObj = (
          m.content && typeof m.content === "object" ? m.content : {}
        ) as any
        const textContent =
          typeof m.content === "string"
            ? m.content
            : (contentObj.text ?? contentObj.prompt ?? "")
        const images: string[] = Array.isArray(contentObj.images)
          ? contentObj.images
          : []

        if (images.length > 0) {
          const parts: Array<any> = []
          if (textContent) {
            parts.push({ type: "text", text: textContent })
          }
          for (const imgUrl of images) {
            parts.push(await fetchImagePart(imgUrl))
          }
          inputMessages.push({
            role: "user",
            content: parts,
          })
        } else {
          inputMessages.push({
            role: "user",
            content:
              textContent ||
              (typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content)),
          })
        }
      } else if (m.role === "assistant" || m.role === "system") {
        let textContent = ""
        if (typeof m.content === "string") {
          textContent = m.content
        } else if (m.content && typeof m.content === "object") {
          textContent =
            (m.content as any).text ??
            (m.content as any).prompt ??
            JSON.stringify(m.content)
        }
        inputMessages.push({
          role: m.role,
          content: textContent,
        })
      }
    }

    // Add current run input
    const inputObj = runRecord.input as any
    const promptText =
      typeof inputObj === "string"
        ? inputObj
        : (inputObj?.prompt ??
          inputObj?.text ??
          (inputObj?.messages ? null : ""))
    const runImages: string[] = Array.isArray(inputObj?.images)
      ? inputObj.images
      : []

    if (promptText || runImages.length > 0) {
      const isScheduleTrigger = runRecord.triggerType === "schedule"
      const effectiveUserPrompt = isScheduleTrigger
        ? `[SYSTEM NOTIFICATION: The timer/scheduled alarm for this task has elapsed now.]\nDeliver this reminder/scheduled alert directly to the user:\n"${promptText}"`
        : promptText

      // Check if already in history as the last message
      const lastMsg = inputMessages[inputMessages.length - 1]
      const isDuplicate =
        lastMsg &&
        lastMsg.role === "user" &&
        (typeof lastMsg.content === "string"
          ? lastMsg.content === effectiveUserPrompt && runImages.length === 0
          : false)

      if (!isDuplicate) {
        if (runImages.length > 0) {
          const parts: Array<any> = []
          if (effectiveUserPrompt) {
            parts.push({ type: "text", text: effectiveUserPrompt })
          }
          for (const imgUrl of runImages) {
            parts.push(await fetchImagePart(imgUrl))
          }
          inputMessages.push({
            role: "user",
            content: parts,
          })
        } else if (effectiveUserPrompt) {
          inputMessages.push({
            role: "user",
            content: effectiveUserPrompt,
          })
        }
      }
    } else if (Array.isArray(inputObj?.messages)) {
      for (const m of inputObj.messages) {
        inputMessages.push(m)
      }
    }

    const connectedApps = activeConnections.map((c) => c.provider)

    let connectionsInstruction = ""
    if (connectedApps.length > 0) {
      connectionsInstruction = `
## Connected Apps:
The user has already connected the following apps: ${connectedApps.join(", ")}.
- Use the corresponding Composio tools (e.g. GMAIL_*, NOTION_*, SLACK_*, GITHUB_*) directly to perform actions on these apps.
- DO NOT ask the user to connect or authorize these apps again. They are already authenticated and ready to use.
- If a tool call fails with an auth error for a connected app, inform the user of the specific error instead of asking them to reconnect.`
    }

    const isScheduledExecution = runRecord.triggerType === "schedule"
    const scheduledExecutionInstruction = isScheduledExecution
      ? `\n\n## SCHEDULED REMINDER EXECUTION:
- You are executing a timer/scheduled reminder that has just fired right now.
- Speak directly to the user to remind or alert them about the task (e.g., "⏰ Reminder: It's time to drink water!" or "Hey, here is your reminder to...").
- DO NOT treat the reminder text as a message sent by the user to you.
- DO NOT ask the user if they did it yet or thank them for reminding you. You are the one reminding the user.
- DO NOT reschedule or recreate this reminder unless explicitly requested.`
      : ""

    const systemInstructions = `${agentRecord.instructions || "You are an AI assistant."}${scheduledExecutionInstruction}

## Scheduling & Reminders:
- You have access to the 'create_schedule' and 'manage_schedule' tools.
- ALWAYS use 'create_schedule' whenever the user asks for a new reminder, alarm, delayed task, or recurring execution (e.g. "remind me in 1 minute to have tea", "schedule a check in 2 hours", "run every Monday at 9am").
- For one-off reminders/delays, specify type="delay" with delaySeconds (e.g. 60 for 1 minute).
- ALWAYS use 'manage_schedule' whenever the user asks to list, check, modify, reschedule, or cancel any queued reminders, delayed tasks, or recurring schedules (e.g. "cancel my tea reminder", "what reminders do I have?", "postpone my check by 30 minutes").
- NEVER prompt the user to connect external services (like Slack, Google Calendar, or Notion) for reminders or timers unless they specifically ask to be notified on that external app.

## Reactions to User Messages:
- You have access to the 'react_to_message' tool to add an emoji reaction (e.g. 👍, ❤️, 🎉, 🔥, 👀, 🚀, 💡, 👏, 🤖) to user messages.
- ONLY use 'react_to_message' when it is genuinely meaningful and natural (e.g., celebrating an accomplishment, acknowledging an exceptional insight, or expressing warm gratitude for kind praise).
- DO NOT react to every routine question or instruction. Keep reactions rare and delightful.

${ARTIFACT_PROMPT}

## Slash Commands & User Intents:
The user can trigger specific workflows using slash command prefixes in their prompts. Honor their intent when present:
- /code <prompt>: The user specifically wants you to write, refactor, or modify code. Deliver production-ready, clean, well-typed code with explanations kept concise and directly relevant.
- /research <query>: Perform deep, exhaustive research. Search for authoritative sources, analyze multiple angles, synthesize insights, and provide a well-structured summary.
- /review <code or request>: Perform a thorough code review. Focus on bugs, security vulnerabilities, edge cases, performance bottlenecks, architecture, and code style. Provide actionable improvements and diff-style suggestions.
- /schedule <task and time>: The user wants to schedule a reminder, timer, or recurring job. Use 'create_schedule' directly.
- /chart <data or description>: Create an interactive chart or data visualization. You can output an inline HTML artifact (<openbots-artifact type="html" title="..." mode="inline">) or SVG visualization.
- /graph <equation/function>: Plot or graph mathematical equations or functions (e.g., using an interactive HTML canvas artifact or SVG plot with mode="inline").
- /diagram <description>: Create a visual diagram (architecture, sequence, workflow, ER diagram). Render it using an inline artifact (<openbots-artifact type="mermaid" title="..." mode="inline"> or type="svg" mode="inline").
- /analyze <prompt>: Thoroughly examine and analyze any attached images, documents, or data provided with the message. Extract key details, patterns, issues, and strategic insights.
- /tasks: Show or inspect the user's scheduled tasks and reminders. Use the 'manage_schedule' tool with action="list" to retrieve active schedules and report their status clearly.${connectionsInstruction}`

    const agent = new ToolLoopAgent({
      model,
      instructions: systemInstructions,
      tools: resolvedTools.tools,
      stopWhen: stepCountIs(agentRecord.maxSteps ?? 10),
    })

    let currentStepNumber = 0
    const pendingStepPersistTasks: Array<Promise<any>> = []

    // Publish initial status
    runEventHub.publish(runRecord.id, {
      type: "status",
      status: "running",
    })

    const generateResult = await agent.generate({
      messages: inputMessages as any,
      abortSignal: abortController.signal,
      onStepFinish: async (step) => {
        // Fast in-memory check first
        if (abortController.signal.aborted) return

        // Batch steps to insert in a single DB roundtrip
        const stepsToInsert: Array<typeof runSteps.$inferInsert> = []

        stepsToInsert.push({
          runId: runRecord.id,
          stepNumber: currentStepNumber++,
          type: "model",
          status: "completed",
          model: agentRecord.model,
          output: {
            text: step.text,
            finishReason: step.finishReason,
            usage: step.usage,
          },
        })

        if (step.toolResults && step.toolResults.length > 0) {
          for (const tr of step.toolResults) {
            stepsToInsert.push({
              runId: runRecord.id,
              stepNumber: currentStepNumber++,
              type: "tool",
              status: "completed",
              toolName: tr.toolName,
              toolCallId: tr.toolCallId,
              toolInput: ((tr as any).input ?? (tr as any).args ?? null) as any,
              toolOutput: ((tr as any).output ??
                (tr as any).result ??
                null) as any,
            })

            runEventHub.publish(runRecord.id, {
              type: "tool_finish",
              toolName: tr.toolName,
              stepNumber: currentStepNumber - 1,
            })
          }
        }

        // Fire-and-track async step insertion without stalling the model generate loop
        const insertPromise = db
          .insert(runSteps)
          .values(stepsToInsert)
          .catch((err) => {
            console.warn("Failed to persist step batch:", err)
          })

        pendingStepPersistTasks.push(insertPromise)
      },
    })

    let finalText = generateResult.text?.trim() || ""
    const finalSteps = generateResult.steps
    const finalUsage = generateResult.usage

    // If finalText is empty but steps were executed (e.g. maxSteps reached right after tool call),
    // extract the last text or provide an informative completion summary so it never silently stops
    if (!finalText && finalSteps && finalSteps.length > 0) {
      for (let i = finalSteps.length - 1; i >= 0; i--) {
        const s = finalSteps[i]
        if (s?.text && s.text.trim()) {
          finalText = s.text.trim()
          break
        }
      }

      if (!finalText) {
        finalText =
          "I finished executing the requested tool actions and reached the step limit."
      }
    }

    // Wait for any remaining background step writes before completing
    if (pendingStepPersistTasks.length > 0) {
      await Promise.allSettled(pendingStepPersistTasks)
    }

    const finalOutput = {
      text: finalText,
      steps: finalSteps?.length ?? 0,
      usage: finalUsage,
    }

    // Parallelize run completion update and assistant message persistence
    const [completedRunRows, insertedMessages] = await Promise.all([
      db
        .update(runs)
        .set({
          status: "completed",
          output: finalOutput,
          completedAt: new Date(),
        })
        .where(and(eq(runs.id, runId), eq(runs.status, "running")))
        .returning(),
      runRecord.conversationId && finalText
        ? db
            .insert(messages)
            .values({
              conversationId: runRecord.conversationId,
              role: "assistant",
              content: { text: finalText },
            })
            .returning()
        : Promise.resolve([]),
    ])

    const completedRun = completedRunRows[0]

    runEventHub.publish(runRecord.id, {
      type: "done",
      status: "completed",
      output: finalOutput,
    })

    if (!completedRun) {
      // Race: run was cancelled or modified concurrently
      const [finalRun] = await db.select().from(runs).where(eq(runs.id, runId))
      return finalRun ?? { id: runId, status: "cancelled", output: finalOutput }
    }

    return completedRun
  } catch (error) {
    // Check if run was cancelled in DB or aborted
    const [currentRun] = await db.select().from(runs).where(eq(runs.id, runId))

    if (currentRun?.status === "cancelled" || abortController.signal.aborted) {
      // Ensure DB status is cancelled if not already marked
      if (currentRun?.status !== "cancelled") {
        await db
          .update(runs)
          .set({
            status: "cancelled",
            completedAt: new Date(),
          })
          .where(and(eq(runs.id, runId), eq(runs.status, "running")))
      }
      runEventHub.publish(runId, {
        type: "status",
        status: "cancelled",
      })
      const [finalRun] = await db.select().from(runs).where(eq(runs.id, runId))
      return finalRun ?? currentRun
    }

    // Conditional failure update: only mark failed if still running
    const safeError = sanitizeErrorMessage(error)
    await db
      .update(runs)
      .set({
        status: "failed",
        error: safeError,
        completedAt: new Date(),
      })
      .where(and(eq(runs.id, runId), eq(runs.status, "running")))

    runEventHub.publish(runId, {
      type: "status",
      status: "failed",
      error: safeError,
    })

    throw new Error(safeError)
  } finally {
    if (resolvedTools) {
      await resolvedTools.cleanup()
    }
  }
}
