"use client";

import { Bubble, BubbleContent } from "@openbots/ui/components/bubble";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@openbots/ui/components/message";
import { Blobatar } from "@openbots/ui/components/ui/blobatar";
import { Markdown } from "@/components/shared/markdown";
import type { MessageItem } from "../types";
import { formatMsgTime, getMessageText } from "../utils";

interface ConversationMessageItemProps {
  message: MessageItem;
  agentName: string;
}

export function ConversationMessageItem({
  message,
  agentName,
}: ConversationMessageItemProps) {
  const isUser = message.role === "user";
  const text = getMessageText(message.content);

  return (
    <MessageGroup>
      <Message align={isUser ? "end" : "start"} className="gap-2">
        <MessageContent>
          <Bubble
            variant={isUser ? "default" : "outline"}
            align={isUser ? "end" : "start"}
          >
            <BubbleContent
              className={
                isUser
                  ? "p-1.5 px-2.5 text-sm whitespace-pre-wrap text-foreground"
                  : "typeset typeset-chat p-1.5 px-2.5 text-sm text-foreground"
              }
            >
              {isUser ? text : <Markdown>{text}</Markdown>}
            </BubbleContent>
          </Bubble>

          {isUser ? (
            <MessageFooter className="justify-end gap-1 px-0">
              <span className="text-xs font-medium text-foreground">You</span>
              <span className="text-[10px] text-muted-foreground">
                {formatMsgTime(message.createdAt)}
              </span>
            </MessageFooter>
          ) : (
            <MessageFooter className="gap-px px-0">
              <Blobatar name={agentName} className="size-6 shrink-0" />
              <span className="text-xs font-medium text-foreground">
                {agentName}
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground">
                {formatMsgTime(message.createdAt)}
              </span>
            </MessageFooter>
          )}
        </MessageContent>
      </Message>
    </MessageGroup>
  );
}
