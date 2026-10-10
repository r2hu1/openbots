export type MessageRole = "system" | "user" | "assistant" | "tool";

export type ReplyTarget = {
  id: string;
  sender: string;
  text: string;
};

export type MessageItem = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: unknown;
  metadata?: Record<string, any> | null;
  createdAt: string | Date;
};

export type Conversation = {
  id: string;
  agentId?: string;
  title?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type ConversationPagination = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type ConversationResponse = {
  conversation: Conversation;
  messages: MessageItem[];
  pagination?: ConversationPagination;
  activeBrowser?: {
    sessionId: string;
    connectUrl: string;
    liveDebuggerUrl?: string;
    liveDebuggerFullscreenUrl?: string;
  } | null;
};
