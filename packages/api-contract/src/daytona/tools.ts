import {
  type CreateDaytonaToolsOptions,
  createDaytonaSandboxContext,
} from "./tools/context.js";
import { createDaytonaFileSystemTools } from "./tools/filesystem.js";
import { createDaytonaInputTools } from "./tools/input.js";
import { createDaytonaScreenTools } from "./tools/screen.js";
import { createDaytonaBrowserTools } from "./tools/browser.js";

export type { CreateDaytonaToolsOptions } from "./tools/context.js";

/**
 * Creates the complete suite of computer use, shell, file system,
 * and desktop screen tools powered by Daytona Sandboxes.
 */
export function createDaytonaTools(
  options: CreateDaytonaToolsOptions,
): Record<string, any> {
  const ctx = createDaytonaSandboxContext(options);

  const fileSystemTools = createDaytonaFileSystemTools(ctx);
  const inputTools = createDaytonaInputTools(ctx);
  const screenTools = createDaytonaScreenTools(ctx);
  const browserTools = createDaytonaBrowserTools(ctx);

  return {
    // Terminal & Filesystem
    bash: fileSystemTools.bash,
    read_file: fileSystemTools.read_file,
    write_file: fileSystemTools.write_file,
    list_files: fileSystemTools.list_files,
    save_and_share_file: fileSystemTools.save_and_share_file,

    // Mouse & Keyboard (Computer Use)
    mouse_click: inputTools.mouse_click,
    mouse_move: inputTools.mouse_move,
    mouse_scroll: inputTools.mouse_scroll,
    keyboard_type: inputTools.keyboard_type,

    // Screen Tools
    view_screen: screenTools.view_screen,
    show_screen: screenTools.show_screen,
    take_screenshot: screenTools.take_screenshot,

    // Browser & Navigation
    browser_navigate: browserTools.browser_navigate,
    browser_click: inputTools.mouse_click, // aliased for backward compatibility
    browser_type: inputTools.keyboard_type, // aliased for backward compatibility
    browser_screenshot: screenTools.take_screenshot, // aliased
    browser_extract_content: browserTools.browser_extract_content,
    browser_scroll: inputTools.mouse_scroll, // aliased
    browser_evaluate: fileSystemTools.bash, // aliased
    browser_wait_for_user: browserTools.browser_wait_for_user,
    browser_close: browserTools.browser_close,
  };
}
