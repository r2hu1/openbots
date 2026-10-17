import { getRedis } from "@openbots/db";

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
  publishBatch(runId: string, events: RunEvent[]): void {
    if (!events.length) return;
    const redis = getRedis();
    if (!redis) return;

    const channelKey = `run_events:${runId}`;
    const seqKey = `run_events_seq:${runId}`;

    redis
      .incrby(seqKey, events.length)
      .then((endSeq) => {
        const startSeq = endSeq - events.length + 1;
        const serialized = events.map((event, idx) =>
          JSON.stringify({
            ...event,
            seq: startSeq + idx,
          }),
        );
        const pipeline = redis.pipeline();
        pipeline.rpush(channelKey, ...serialized);
        pipeline.expire(channelKey, 3600);
        pipeline.expire(seqKey, 3600);
        return pipeline.exec();
      })
      .catch((err) => {
        console.error("Failed to publish batch run events to Redis:", err);
      });
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
    const redis = getRedis();
    if (!redis) return;

    const channelKey = `user_agent_events:${userId}`;
    const seqKey = `user_agent_events_seq:${userId}`;

    redis
      .incr(seqKey)
      .then((seq) => {
        const eventWithSeq: UserAgentEvent = {
          ...event,
          seq,
        };
        const serialized = JSON.stringify(eventWithSeq);
        const pipeline = redis.pipeline();
        pipeline.rpush(channelKey, serialized);
        pipeline.expire(channelKey, 1800);
        pipeline.expire(seqKey, 1800);
        return pipeline.exec();
      })
      .catch((err) => {
        console.error("Failed to publish user event to Redis:", err);
      });
  }

  publish(agentId: string, event: AgentEvent, userId?: string): void {
    const redis = getRedis();

    if (redis) {
      const channelKey = `agent_events:${agentId}`;
      const seqKey = `agent_events_seq:${agentId}`;

      redis
        .incr(seqKey)
        .then((seq) => {
          const eventWithSeq: AgentEvent = {
            ...event,
            seq,
          };
          const serialized = JSON.stringify(eventWithSeq);
          const pipeline = redis.pipeline();
          pipeline.rpush(channelKey, serialized);
          pipeline.expire(channelKey, 1800);
          pipeline.expire(seqKey, 1800);
          return pipeline.exec();
        })
        .catch((err) => {
          console.error("Failed to publish agent event to Redis:", err);
        });
    }

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
