import { generateBlobatarSvg } from "@openbots/ui/lib/blobatar-svg";
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
        const svg = generateBlobatarSvg(data.agent.name, {
          size: 32,
        });
        const iconDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

        return {
          title: data.agent.name,
          description:
            data.agent.description ||
            `Autonomous agent workspace for ${data.agent.name}`,
          icons: {
            icon: iconDataUrl,
          },
        };
      }
    }
  } catch {
    // Fall back to default title if unreachable during metadata generation
  }

  const defaultSvg = generateBlobatarSvg(id, { size: 32 });
  const defaultIconDataUrl = `data:image/svg+xml;base64,${Buffer.from(defaultSvg).toString("base64")}`;

  return {
    title: "Agent Workspace",
    description:
      "Manage, orchestrate, and chat with your autonomous AI agents.",
    icons: {
      icon: defaultIconDataUrl,
    },
  };
}

export default async function SelectedAgentPage({ params }: AgentPageProps) {
  const { id } = await params;
  return <AgentWorkspace initialAgentId={id} />;
}
