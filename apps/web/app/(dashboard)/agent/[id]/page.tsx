import type { Metadata } from "next";
import { getClient } from "@/lib/api";
import { AgentWorkspace } from "@/modules/agents/components/agent-workspace";

interface AgentPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AgentPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const client = getClient();
    const res = await client.api.agents[":id"].summary.$get({
      param: { id },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        agent?: { name: string; description: string | null };
      };
      if (data.agent?.name) {
        return {
          title: data.agent.name,
          description:
            data.agent.description ||
            `Autonomous agent workspace for ${data.agent.name}`,
        };
      }
    }
  } catch {
    // Fall back to default title if unreachable during metadata generation
  }

  return {
    title: "Agent Workspace",
    description:
      "Manage, orchestrate, and chat with your autonomous AI agents.",
  };
}

export default async function SelectedAgentPage({ params }: AgentPageProps) {
  const { id } = await params;
  return <AgentWorkspace initialAgentId={id} />;
}
