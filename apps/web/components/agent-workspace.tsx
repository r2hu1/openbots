"use client";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@openbots/ui/components/empty";
import { Button } from "@openbots/ui/components/button";
import { SidebarInset, SidebarProvider } from "@openbots/ui/components/sidebar";
import { Spinner } from "@openbots/ui/components/spinner";
import { IconPlus, IconRobot } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { AgentHeader } from "@/components/agent-header";
import { AuthGuard } from "@/components/auth-guard";
import {
  type AgentData,
  ConfigureAgentSheet,
} from "@/components/configure-agent-sheet";
import { ConnectionsSheet } from "@/components/connections-sheet";
import {
  ConversationTimeline,
  type MessageItem,
} from "@/components/conversation-timeline";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import type { StepItem } from "@/components/execution-steps-card";
import { InputComposer } from "@/components/input-composer";
import {
  RunHistorySheet,
  type RunRecord,
} from "@/components/run-history-sheet";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { getClient } from "@/lib/api";

interface AgentWorkspaceProps {
  initialAgentId?: string;
}

export function AgentWorkspace({ initialAgentId }: AgentWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Active state
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(
    initialAgentId || null,
  );
  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(null);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [isOptimisticRunning, setIsOptimisticRunning] = React.useState(false);
  const [optimisticMessages, setOptimisticMessages] = React.useState<
    MessageItem[]
  >([]);

  // Dialogs / Sheets
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  const [configureSheetOpen, setConfigureSheetOpen] = React.useState(false);
  const [historySheetOpen, setHistorySheetOpen] = React.useState(false);
  const [connectionsSheetOpen, setConnectionsSheetOpen] = React.useState(false);
  const [inspectedRunId, setInspectedRunId] = React.useState<string | null>(
    null,
  );

  // 1. Fetch Real User Agents
  const { data: agentsData, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const client = getClient();
      const res = await client.api.agents.$get();
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json() as Promise<{ agents: AgentData[] }>;
    },
  });

  const agents = agentsData?.agents || [];

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

  // Track previous selectedAgentId to only reset state when agent actually changes
  const prevAgentIdRef = React.useRef(selectedAgentId);
  React.useEffect(() => {
    if (prevAgentIdRef.current !== selectedAgentId) {
      prevAgentIdRef.current = selectedAgentId;
      setActiveConversationId(null);
      setActiveRunId(null);
      setIsOptimisticRunning(false);
      setOptimisticMessages([]);
    }
  }, [selectedAgentId]);

  // 2. Fetch Conversations for selected agent
  const { data: conversationsData, isLoading: isLoadingConversations } =
    useQuery({
      queryKey: ["conversations", selectedAgentId],
      queryFn: async () => {
        if (!selectedAgentId) return { conversations: [] };
        const client = getClient();
        const res = await client.api.conversations.$get({
          query: { agentId: selectedAgentId },
        });
        if (!res.ok) return { conversations: [] };
        return res.json() as Promise<{ conversations: Array<{ id: string }> }>;
      },
      enabled: !!selectedAgentId,
    });

  React.useEffect(() => {
    const list = conversationsData?.conversations;
    if (list && list.length > 0 && list[0]?.id) {
      // If no active conversation or current active conversation doesn't belong to this agent's list
      if (!activeConversationId || !list.some((c) => c.id === activeConversationId)) {
        setActiveConversationId(list[0].id);
      }
    }
  }, [conversationsData, activeConversationId]);

  // 3. Fetch Messages for active conversation
  const { data: conversationDetail, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["conversation", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return { messages: [] };
      const client = getClient();
      const res = await client.api.conversations[":id"].$get({
        param: { id: activeConversationId },
      });
      if (!res.ok) return { messages: [] };
      return res.json() as Promise<{
        conversation: { id: string };
        messages: MessageItem[];
      }>;
    },
    enabled: !!activeConversationId,
  });

  const isChatLoading =
    Boolean(selectedAgentId) &&
    (isLoadingConversations ||
      (Boolean(activeConversationId) && isLoadingMessages) ||
      (Boolean(conversationsData?.conversations?.length) && !activeConversationId));

  const serverMessages = conversationDetail?.messages || [];

  // Reconcile optimistic messages: once the server returns messages containing the optimistic text, clear them
  React.useEffect(() => {
    if (serverMessages.length > 0 && optimisticMessages.length > 0) {
      setOptimisticMessages((prev) =>
        prev.filter((opt) => {
          const optText =
            typeof opt.content === "object" &&
            opt.content &&
            "text" in opt.content
              ? (opt.content as { text: string }).text
              : String(opt.content);
          return !serverMessages.some((srv) => {
            const srvText =
              typeof srv.content === "object" &&
              srv.content &&
              "text" in srv.content
                ? (srv.content as { text: string }).text
                : String(srv.content);
            return srv.role === "user" && srvText === optText;
          });
        }),
      );
    }
  }, [serverMessages, optimisticMessages.length]);

  const messages = React.useMemo(() => {
    return [...serverMessages, ...optimisticMessages];
  }, [serverMessages, optimisticMessages]);

  // 4. Discover and Poll Active Run across reloads
  // Fetch latest runs for selected agent to resume any in-flight queued/running task on refresh
  const { data: runsData } = useQuery({
    queryKey: ["runs", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return { runs: [] };
      const client = getClient();
      const res = await client.api.runs.$get({
        query: { agentId: selectedAgentId },
      });
      if (!res.ok) return { runs: [] };
      return res.json() as Promise<{ runs: RunRecord[] }>;
    },
    enabled: !!selectedAgentId,
  });

  // Auto-connect to in-flight run for the active conversation if present
  React.useEffect(() => {
    if (!activeRunId && runsData?.runs) {
      const ongoingRun = runsData.runs.find(
        (r) =>
          (r.status === "queued" || r.status === "running") &&
          (!activeConversationId || r.conversationId === activeConversationId),
      );
      if (ongoingRun) {
        setActiveRunId(ongoingRun.id);
      }
    }
  }, [activeRunId, runsData?.runs, activeConversationId]);

  const { data: activeRunData } = useQuery({
    queryKey: ["run", activeRunId],
    queryFn: async () => {
      if (!activeRunId) return null;
      const client = getClient();
      const res = await client.api.runs[":id"].$get({
        param: { id: activeRunId },
      });
      if (!res.ok) throw new Error("Failed to fetch active run");
      return res.json() as Promise<{ run: RunRecord; steps: StepItem[] }>;
    },
    enabled: !!activeRunId,
    refetchInterval: (query) => {
      const status = query.state.data?.run?.status;
      if (status === "queued" || status === "running") {
        return 1200;
      }
      return false;
    },
  });

  const activeRunStatus = activeRunData?.run?.status;
  React.useEffect(() => {
    if (
      activeRunStatus === "completed" ||
      activeRunStatus === "failed" ||
      activeRunStatus === "cancelled"
    ) {
      setIsOptimisticRunning(false);
      if (activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", activeConversationId],
        });
      }
      if (selectedAgentId) {
        queryClient.invalidateQueries({
          queryKey: ["runs", selectedAgentId],
        });
      }
    }
  }, [activeRunStatus, activeConversationId, selectedAgentId, queryClient]);

  // 5. Submit Run Mutation with Optimistic UI updates
  const runMutation = useMutation({
    onMutate: async (prompt: string) => {
      setIsOptimisticRunning(true);
      const tempId = `optimistic-${Date.now()}`;
      const optimisticMsg: MessageItem = {
        id: tempId,
        conversationId: activeConversationId || "temp",
        role: "user",
        content: { text: prompt },
        createdAt: new Date(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticMsg]);
      return { tempId };
    },
    mutationFn: async (prompt: string) => {
      if (!selectedAgentId) throw new Error("No agent selected");
      const client = getClient();
      const res = await client.api.agents[":id"].runs.$post({
        param: { id: selectedAgentId },
        json: {
          prompt,
          conversationId: activeConversationId || undefined,
        },
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error || "Failed to trigger run");
      }

      return res.json() as Promise<{
        run: {
          id: string;
          status: RunRecord["status"];
          conversationId?: string | null;
        };
      }>;
    },
    onSuccess: (data) => {
      const targetConvId = data.run.conversationId || activeConversationId;
      if (data.run.conversationId && !activeConversationId) {
        setActiveConversationId(data.run.conversationId);
      }
      setActiveRunId(data.run.id);
      if (targetConvId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation", targetConvId],
        });
      }
      if (selectedAgentId) {
        queryClient.invalidateQueries({
          queryKey: ["runs", selectedAgentId],
        });
        queryClient.invalidateQueries({
          queryKey: ["conversations", selectedAgentId],
        });
      }
    },
    onError: (_err, _prompt, context) => {
      setIsOptimisticRunning(false);
      if (context?.tempId) {
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.id !== context.tempId),
        );
      }
    },
  });

  // 6. Cancel Run Mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!activeRunId) {
        setIsOptimisticRunning(false);
        return;
      }
      const client = getClient();
      const res = await client.api.runs[":id"].cancel.$post({
        param: { id: activeRunId },
      });
      if (!res.ok) throw new Error("Failed to cancel run");
      return res.json();
    },
    onSuccess: () => {
      setIsOptimisticRunning(false);
      queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
      if (selectedAgentId) {
        queryClient.invalidateQueries({
          queryKey: ["runs", selectedAgentId],
        });
      }
    },
    onError: () => {
      setIsOptimisticRunning(false);
    },
  });

  const isActiveRun =
    isOptimisticRunning ||
    activeRunStatus === "queued" ||
    activeRunStatus === "running";

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <div className="flex h-svh w-full overflow-hidden bg-background">
          {/* Narrow Persistent Sidebar */}
          <WorkspaceSidebar
            agents={agents}
            onOpenCreate={() => setCreateDialogOpen(true)}
          />

          {/* Large Agent Workspace */}
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
                <div className="flex flex-1 items-center justify-center">
                  <Spinner className="size-6 text-muted-foreground" />
                </div>
              ) : !selectedAgent ? (
                <div className="flex flex-1 items-center justify-center p-6">
                  <Empty className="max-w-md border rounded-xl bg-card p-8 shadow-xs">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <IconRobot className="size-6 text-primary" />
                      </EmptyMedia>
                      <EmptyTitle>Zero Agents Configured</EmptyTitle>
                      <EmptyDescription>
                        Create your first autonomous agent to coordinate tools
                        and multi-step tasks.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        onClick={() => setCreateDialogOpen(true)}
                        className="gap-1.5"
                      >
                        <IconPlus className="size-4" />
                        Create Agent
                      </Button>
                    </EmptyContent>
                  </Empty>
                </div>
              ) : (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <ConversationTimeline
                    messages={messages}
                    activeRun={activeRunData?.run || null}
                    activeRunSteps={activeRunData?.steps || []}
                    onCancelRun={() => cancelMutation.mutate()}
                    isCancelling={cancelMutation.isPending}
                    agentName={selectedAgent.name}
                    isOptimisticRunning={isOptimisticRunning}
                    isLoading={isChatLoading}
                  />

                  <InputComposer
                    onSend={(prompt) => runMutation.mutate(prompt)}
                    isSubmitting={runMutation.isPending}
                    isActiveRun={isActiveRun}
                    onCancelRun={() => cancelMutation.mutate()}
                    isCancelling={cancelMutation.isPending}
                    placeholder={`Send task to ${selectedAgent.name}...`}
                  />
                </div>
              )}
            </main>
          </SidebarInset>

          {/* Modals & Sheets */}
          <CreateAgentDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onAgentCreated={(newId) => {
              setSelectedAgentId(newId);
              setActiveConversationId(null);
              setActiveRunId(null);
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
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
