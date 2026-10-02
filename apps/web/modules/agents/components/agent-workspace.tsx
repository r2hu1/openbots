"use client";

import { SidebarInset } from "@openbots/ui/components/sidebar";
import { IconPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AgentHeader } from "@/modules/agents/components/agent-header";
import { ConfigureAgentSheet } from "@/modules/agents/components/configure-agent-sheet";
import { CreateAgentDialog } from "@/modules/agents/components/create-agent-dialog";
import { useAgentExecution } from "@/modules/agents/hooks/use-agent-execution";
import { useAgentsQuery } from "@/modules/agents/queries";
import { ConnectionsSheet } from "@/modules/connections/components/connections-sheet";
import { ConversationTimeline } from "@/modules/conversations/components/conversation-timeline";
import { InputComposer } from "@/modules/conversations/components/input-composer";
import { useReconciledMessages } from "@/modules/conversations/hooks/use-reconciled-messages";
import {
  useConversationDetailQuery,
  useConversationsQuery,
} from "@/modules/conversations/queries";
import { RunHistorySheet } from "@/modules/runs/components/run-history-sheet";

interface AgentWorkspaceProps {
  initialAgentId?: string;
}

export function AgentWorkspace({ initialAgentId }: AgentWorkspaceProps) {
  const router = useRouter();

  // Selection state
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(
    initialAgentId || null,
  );
  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(null);

  // Sheets & Dialogs
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [configureSheetOpen, setConfigureSheetOpen] = React.useState(false);
  const [historySheetOpen, setHistorySheetOpen] = React.useState(false);
  const [connectionsSheetOpen, setConnectionsSheetOpen] = React.useState(false);
  const [inspectedRunId, setInspectedRunId] = React.useState<string | null>(
    null,
  );

  // 1. Fetch Agents
  const { data: agents = [], isLoading: isLoadingAgents } = useAgentsQuery();

  // Sync route / initial agent ID
  React.useEffect(() => {
    if (initialAgentId) {
      setSelectedAgentId(initialAgentId);
    } else if (agents.length > 0 && !selectedAgentId && agents[0]?.id) {
      setSelectedAgentId(agents[0].id);
      router.replace(`/agent/${agents[0].id}`);
    }
  }, [initialAgentId, agents, selectedAgentId, router]);

  const selectedAgent = agents.find((ag) => ag.id === selectedAgentId) || null;

  // Reset active conversation on agent change
  const prevAgentIdRef = React.useRef(selectedAgentId);
  React.useEffect(() => {
    if (prevAgentIdRef.current !== selectedAgentId) {
      prevAgentIdRef.current = selectedAgentId;
      setActiveConversationId(null);
    }
  }, [selectedAgentId]);

  // 2. Fetch Conversations
  const { data: conversations = [], isLoading: isLoadingConversations } =
    useConversationsQuery(selectedAgentId);

  React.useEffect(() => {
    if (conversations.length > 0 && conversations[0]?.id) {
      if (
        !activeConversationId ||
        !conversations.some((c) => c.id === activeConversationId)
      ) {
        setActiveConversationId(conversations[0].id);
      }
    }
  }, [conversations, activeConversationId]);

  // 3. Execution Engine Hook
  const {
    activeRun,
    activeRunSteps,
    isActiveRun,
    isOptimisticRunning,
    optimisticMessages,
    setOptimisticMessages,
    sendPrompt,
    cancelActiveRun,
    isSubmitting,
    isCancelling,
  } = useAgentExecution({
    agentId: selectedAgentId,
    activeConversationId,
    onConversationCreated: (newConvId) => {
      setActiveConversationId(newConvId);
    },
  });

  // 4. Fetch Conversation Detail / Messages
  const { data: conversationDetail, isLoading: isLoadingMessages } =
    useConversationDetailQuery(activeConversationId, {
      refetchInterval:
        isOptimisticRunning ||
        activeRun?.status === "running" ||
        activeRun?.status === "queued"
          ? 1500
          : false,
    });

  const serverMessages = conversationDetail?.messages || [];

  // 5. Reconcile Messages
  const messages = useReconciledMessages({
    serverMessages,
    optimisticMessages,
    activeRun,
    activeConversationId,
    onClearOptimistic: () => setOptimisticMessages([]),
  });

  const isChatLoading =
    Boolean(selectedAgentId) &&
    !isOptimisticRunning &&
    optimisticMessages.length === 0 &&
    (isLoadingConversations ||
      (Boolean(activeConversationId) && isLoadingMessages) ||
      (conversations.length > 0 && !activeConversationId));

  return (
    <>
      <SidebarInset className="flex flex-1 flex-col overflow-hidden">
        <AgentHeader
          selectedAgent={selectedAgent}
          onOpenConfigure={() => setConfigureSheetOpen(true)}
          onOpenHistory={() => {
            setInspectedRunId(null);
            setHistorySheetOpen(true);
          }}
          onOpenConnections={() => setConnectionsSheetOpen(true)}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {isLoadingAgents ? (
            <LoadingState label="Loading workspace agents..." />
          ) : !selectedAgent ? (
            <EmptyState
              blobatarName="OpenBots"
              title="Zero Agents Configured"
              description="Create your first autonomous agent to coordinate tools and multi-step tasks."
              actionLabel="Create Agent"
              actionIcon={<IconPlus className="size-4" />}
              onAction={() => setCreateDialogOpen(true)}
            />
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <ConversationTimeline
                messages={messages}
                activeRun={activeRun}
                activeRunSteps={activeRunSteps}
                onCancelRun={cancelActiveRun}
                isCancelling={isCancelling}
                agentName={selectedAgent.name}
                isOptimisticRunning={isOptimisticRunning}
                isLoading={isChatLoading}
              />

              <InputComposer
                onSend={sendPrompt}
                isSubmitting={isSubmitting}
                isActiveRun={isActiveRun}
                onCancelRun={cancelActiveRun}
                isCancelling={isCancelling}
                placeholder={`Send task to ${selectedAgent.name}...`}
              />
            </div>
          )}
        </main>
      </SidebarInset>

      <CreateAgentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAgentCreated={(newId) => {
          setSelectedAgentId(newId);
          setActiveConversationId(null);
          router.push(`/agent/${newId}`);
        }}
      />

      <ConfigureAgentSheet
        agent={selectedAgent}
        open={configureSheetOpen}
        onOpenChange={setConfigureSheetOpen}
      />

      <RunHistorySheet
        agentId={selectedAgentId}
        open={historySheetOpen}
        onOpenChange={setHistorySheetOpen}
        selectedRunId={inspectedRunId}
        onSelectRunId={setInspectedRunId}
      />

      <ConnectionsSheet
        open={connectionsSheetOpen}
        onOpenChange={setConnectionsSheetOpen}
      />
    </>
  );
}
