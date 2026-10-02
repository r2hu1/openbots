import type { Metadata } from "next";
import { AgentWorkspace } from "@/modules/agents/components/agent-workspace";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Manage, orchestrate, and chat with your autonomous AI agents.",
};

export default function RootWorkspacePage() {
  return <AgentWorkspace />;
}
