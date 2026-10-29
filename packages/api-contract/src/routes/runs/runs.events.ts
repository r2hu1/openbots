import { EventEmitter } from "node:events";

// Process-local bus fallback to guarantee zero-latency delivery even without Redis or during quota limits
export const runLocalEmitter = new EventEmitter();
runLocalEmitter.setMaxListeners(100);

export const agentLocalEmitter = new EventEmitter();
agentLocalEmitter.setMaxListeners(100);

export const userLocalEmitter = new EventEmitter();
userLocalEmitter.setMaxListeners(100);

// Cross-process event publisher using Redis for scale
export type RunEvent =
  | { seq?: number; type: "delta"; text: string }
  | {
      seq?: number;
      type: "tool_start";
      toolName: string;
      toolCallId?: string;
      stepNumber?: number;
      input?: any;
    }
  | {
      seq?: number;
      type: "tool_finish";
      toolName: string;
      toolCallId?: string;
      stepNumber?: number;
      input?: any;
      output?: any;
    }
  | {
      seq?: number;
      type: "status";
      status: string;
      output?: any;
      error?: string;
      steps?: any[];
    }
  | { seq?: number; type: "done"; status: string; output?: any };

class RunEventHub {
  private localSeqMap = new Map<string, number>();

  publishBatch(runId: string, events: RunEvent[]): void {
    if (!events.length) return;

    // Maintain monotonic sequence numbers for process-local delivery
    const currentLocalSeq = this.localSeqMap.get(runId) ?? 0;
    const eventsWithSeq: RunEvent[] = events.map((ev, idx) => {
      const seq = ev.seq ?? currentLocalSeq + idx + 1;
      return { ...ev, seq };
    });
    this.localSeqMap.set(runId, currentLocalSeq + events.length);

    for (const ev of eventsWithSeq) {
      runLocalEmitter.emit(runId, ev);
    }
  }

  publish(runId: string, event: RunEvent): void {
    this.publishBatch(runId, [event]);
  }
}

export const runEventHub = new RunEventHub();

export type AgentEvent =
  | { seq?: number; type: "run_created"; run: any }
  | {
      seq?: number;
      type: "run_status";
      runId: string;
      status: string;
      error?: string;
      output?: any;
      conversationId?: string | null;
    }
  | {
      seq?: number;
      type: "schedule_fired";
      scheduleId?: string;
      runId: string;
      name?: string;
      prompt?: string;
      conversationId?: string | null;
    }
  | {
      seq?: number;
      type: "schedule_updated";
      scheduleId: string;
      action: "created" | "updated" | "deleted";
    }
  | {
      seq?: number;
      type: "agent_updated";
      agentId: string;
      status?: string;
      lastMessage?: string | null;
      runId?: string;
    };

export type UserAgentEvent = AgentEvent & { agentId: string };

class AgentEventHub {
  publishUser(userId: string, event: UserAgentEvent): void {
    userLocalEmitter.emit(userId, event);
  }

  publish(agentId: string, event: AgentEvent, userId?: string): void {
    agentLocalEmitter.emit(agentId, event);
    if (userId) {
      this.publishUser(userId, { ...event, agentId });
    }
  }
}

export const agentEventHub = new AgentEventHub();

export type DirectRunExecutor = (runId: string) => Promise<any>;
let directRunExecutor: DirectRunExecutor | null = null;

export function registerDirectRunExecutor(executor: DirectRunExecutor) {
  directRunExecutor = executor;
}

export function getDirectRunExecutor(): DirectRunExecutor | null {
  return directRunExecutor;
}

export type DirectRunCanceller = (runId: string, reason?: string) => void;
let directRunCanceller: DirectRunCanceller | null = null;

export function registerDirectRunCanceller(canceller: DirectRunCanceller) {
  directRunCanceller = canceller;
}

export function getDirectRunCanceller(): DirectRunCanceller | null {
  return directRunCanceller;
}
