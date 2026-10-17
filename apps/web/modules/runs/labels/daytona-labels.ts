import type { StepItem } from "../types"
import { truncateText, tryExtractHostname } from "./label-utils"

export function resolveDaytonaTool(
  normalized: string,
  status: StepItem["status"] | undefined,
  inputObj: Record<string, unknown> | null
): { label: string; detail?: string } | null {
  const isRunning = status === "running"
  const isFailed = status === "failed"

  if (normalized === "browser_navigate") {
    const url = typeof inputObj?.url === "string" ? inputObj.url : null
    const host = url ? tryExtractHostname(url) : null
    if (isRunning) {
      return {
        label: host ? `Navigating browser to ${host}...` : "Opening browser...",
        detail: url ?? undefined,
      }
    }
    if (isFailed) {
      return {
        label: `Failed to navigate browser to ${host || "URL"}`,
        detail: url ?? undefined,
      }
    }
    return {
      label: host ? `Navigated browser to ${host}` : "Navigated browser",
      detail: url ?? undefined,
    }
  }

  if (normalized === "browser_click") {
    const selector =
      typeof inputObj?.selector === "string" ? inputObj.selector : null
    if (isRunning)
      return {
        label: `Clicking element "${selector ?? "target"}"...`,
        detail: selector ?? undefined,
      }
    if (isFailed)
      return { label: "Failed to click element", detail: selector ?? undefined }
    return {
      label: `Clicked element "${selector ?? "target"}"`,
      detail: selector ?? undefined,
    }
  }

  if (normalized === "browser_type") {
    const text = typeof inputObj?.text === "string" ? inputObj.text : null
    const selector =
      typeof inputObj?.selector === "string" ? inputObj.selector : null
    if (isRunning)
      return {
        label: text
          ? `Typing "${truncateText(text, 24)}"...`
          : "Typing in browser...",
        detail: selector ?? undefined,
      }
    if (isFailed)
      return {
        label: "Failed to type in browser",
        detail: selector ?? undefined,
      }
    return {
      label: text
        ? `Typed "${truncateText(text, 24)}"`
        : "Typed text in browser",
      detail: selector ?? undefined,
    }
  }

  if (normalized === "browser_screenshot") {
    if (isRunning) return { label: "Capturing browser screenshot..." }
    if (isFailed) return { label: "Failed to take screenshot" }
    return { label: "Captured browser screenshot" }
  }

  if (normalized === "browser_extract_content") {
    if (isRunning) return { label: "Extracting page content from browser..." }
    if (isFailed) return { label: "Failed to extract page content" }
    return { label: "Extracted page content" }
  }

  if (normalized === "browser_scroll") {
    const dir = inputObj?.direction === "up" ? "up" : "down"
    if (isRunning) return { label: `Scrolling page ${dir}...` }
    if (isFailed) return { label: "Failed to scroll page" }
    return { label: `Scrolled page ${dir}` }
  }

  if (normalized === "browser_evaluate") {
    if (isRunning) return { label: "Evaluating JavaScript in browser..." }
    if (isFailed) return { label: "Failed to run JavaScript in browser" }
    return { label: "Evaluated script in browser" }
  }

  if (normalized === "browser_wait_for_user") {
    const message =
      typeof inputObj?.message === "string" ? inputObj.message : null
    if (isRunning)
      return {
        label: message
          ? `Waiting for user: "${message}"`
          : "Waiting for user action in browser...",
      }
    if (isFailed) return { label: "User action timed out" }
    return { label: "User interaction completed" }
  }

  if (normalized === "browser_close") {
    if (isRunning) return { label: "Closing desktop processes..." }
    if (isFailed) return { label: "Failed to close desktop" }
    return { label: "Closed desktop processes" }
  }

  // Terminal & Filesystem
  if (normalized === "bash") {
    const cmd = typeof inputObj?.command === "string" ? inputObj.command : null
    if (isRunning)
      return {
        label: cmd
          ? `Running bash "${truncateText(cmd, 30)}"...`
          : "Executing terminal command...",
        detail: cmd ?? undefined,
      }
    if (isFailed)
      return { label: "Terminal command failed", detail: cmd ?? undefined }
    return {
      label: cmd
        ? `Executed "${truncateText(cmd, 30)}"`
        : "Executed terminal command",
      detail: cmd ?? undefined,
    }
  }

  if (normalized === "read_file") {
    const path = typeof inputObj?.path === "string" ? inputObj.path : null
    if (isRunning)
      return {
        label: path ? `Reading ${path}...` : "Reading file...",
        detail: path ?? undefined,
      }
    if (isFailed)
      return { label: "Failed to read file", detail: path ?? undefined }
    return {
      label: path ? `Read ${path}` : "Read file",
      detail: path ?? undefined,
    }
  }

  if (normalized === "write_file") {
    const path = typeof inputObj?.path === "string" ? inputObj.path : null
    if (isRunning)
      return {
        label: path ? `Writing ${path}...` : "Writing file...",
        detail: path ?? undefined,
      }
    if (isFailed)
      return { label: "Failed to write file", detail: path ?? undefined }
    return {
      label: path ? `Wrote ${path}` : "Wrote file",
      detail: path ?? undefined,
    }
  }

  if (normalized === "list_files") {
    const path = typeof inputObj?.path === "string" ? inputObj.path : null
    if (isRunning)
      return {
        label: path ? `Listing ${path}...` : "Listing directory...",
        detail: path ?? undefined,
      }
    if (isFailed)
      return { label: "Failed to list files", detail: path ?? undefined }
    return {
      label: path ? `Listed ${path}` : "Listed files",
      detail: path ?? undefined,
    }
  }

  // Mouse & Keyboard (Computer Use)
  if (normalized === "mouse_click") {
    const x = inputObj?.x
    const y = inputObj?.y
    const target =
      inputObj?.elementName ?? (x !== undefined ? `(${x}, ${y})` : "desktop")
    if (isRunning) return { label: `Clicking ${target}...` }
    if (isFailed) return { label: `Failed to click ${target}` }
    return { label: `Clicked ${target}` }
  }

  if (normalized === "mouse_move") {
    const x = inputObj?.x
    const y = inputObj?.y
    if (isRunning) return { label: `Moving mouse to (${x}, ${y})...` }
    if (isFailed) return { label: "Failed to move mouse" }
    return { label: `Moved mouse to (${x}, ${y})` }
  }

  if (normalized === "mouse_scroll") {
    const dir = inputObj?.direction === "up" ? "up" : "down"
    if (isRunning) return { label: `Scrolling ${dir}...` }
    if (isFailed) return { label: "Failed to scroll" }
    return { label: `Scrolled ${dir}` }
  }

  if (normalized === "keyboard_type") {
    const text = typeof inputObj?.text === "string" ? inputObj.text : null
    if (isRunning)
      return {
        label: text
          ? `Typing "${truncateText(text, 24)}"...`
          : "Typing text...",
      }
    if (isFailed) return { label: "Failed to type text" }
    return {
      label: text ? `Typed "${truncateText(text, 24)}"` : "Typed text",
    }
  }

  if (normalized === "view_screen") {
    if (isRunning) return { label: "Inspecting screen..." }
    if (isFailed) return { label: "Failed to inspect screen" }
    return { label: "Inspected desktop screen" }
  }

  if (normalized === "show_screen") {
    if (isRunning) return { label: "Opening live screen preview..." }
    if (isFailed) return { label: "Failed to open live screen" }
    return { label: "Opened live screen preview for user" }
  }

  if (normalized === "take_screenshot") {
    if (isRunning) return { label: "Capturing screenshot..." }
    if (isFailed) return { label: "Failed to take screenshot" }
    return { label: "Captured screenshot" }
  }

  return null
}
