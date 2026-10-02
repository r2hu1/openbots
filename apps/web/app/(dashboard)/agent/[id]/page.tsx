import { AgentWorkspace } from "@/modules/agents/components/agent-workspace";

interface AgentPageProps {
  params: Promise<{ id: string }>;
}

export default async function SelectedAgentPage({ params }: AgentPageProps) {
  const { id } = await params;
  return <AgentWorkspace initialAgentId={id} />;
}
