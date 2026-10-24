"use client"

import { Bubble, BubbleContent } from "@openbots/ui/components/bubble"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@openbots/ui/components/context-menu"
import { Message, MessageContent } from "@openbots/ui/components/message"
import * as React from "react"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import { parseArtifacts } from "@/modules/artifacts/parser"
import type { MessageItem, ReplyTarget } from "../types"
import {
  getMessageAttachments,
  getMessageImages,
  getMessageText,
} from "../utils"
import { MessageActions } from "./message-item/message-actions"
import { MessageContextMenuContent } from "./message-item/message-context-menu"
import { MessageHeaderAvatar } from "./message-item/message-header-avatar"
import { MessagePartsView } from "./message-item/message-parts-view"
import { MessageReactions } from "./message-item/message-reactions"
import { MessageSelectionToolbar } from "./message-item/message-selection-toolbar"
import { useMessageExport } from "./message-item/use-message-export"
import { useMessageReactions } from "./message-item/use-message-reactions"
import { useMessageSelection } from "./message-item/use-message-selection"
import { UserAttachments } from "./message-item/user-attachments"

interface ConversationMessageItemProps {
  message: MessageItem
  agentName: string
  onOpenArtifact?: (artifact: ParsedArtifact) => void
  onReply?: (target: ReplyTarget) => void
  onReact?: (messageId: string, emoji: string) => void
  isStreaming?: boolean
}

export const ConversationMessageItem = React.memo(
  function ConversationMessageItem({
    message,
    agentName,
    onOpenArtifact,
    onReply,
    onReact,
  }: ConversationMessageItemProps) {
    const isUser = message.role === "user"
    const [isContextOpen, setIsContextOpen] = React.useState(false)
    const bubbleRef = React.useRef<HTMLDivElement>(null)

    const text = getMessageText(message.content)
    const images = React.useMemo(
      () => getMessageImages(message.content),
      [message.content]
    )
    const attachments = React.useMemo(
      () => getMessageAttachments(message.content),
      [message.content]
    )

    const { reactions, handleReaction } = useMessageReactions({
      messageId: message.id,
      isUser,
      text,
      metadata: message.metadata,
      onReact,
      bubbleRef,
    })

    const messageParts = React.useMemo(() => {
      if (isUser) {
        return [
          {
            partId: `usr-${message.id}`,
            segments: [
              { id: `usr-${message.id}`, type: "text" as const, text },
            ],
          },
        ]
      }
      return [
        {
          partId: `asst-${message.id}`,
          segments: parseArtifacts(text).segments,
        },
      ]
    }, [isUser, message.id, text])

    const { copied, shared, handleCopy, handleShare, handleDownload } =
      useMessageExport({
        messageId: message.id,
        role: message.role,
        createdAt: message.createdAt,
        text,
        isUser,
        agentName,
      })

    const {
      selectedText,
      selectionPosition,
      handleMouseUp,
      handleReplySelected,
      handleReply,
    } = useMessageSelection({
      text,
      isUser,
      agentName,
      messageId: message.id,
      onReply,
      bubbleRef,
    })

    return (
      <ContextMenu
        open={isContextOpen}
        onOpenChange={() => setIsContextOpen(!isContextOpen)}
      >
        <ContextMenuTrigger className="block w-full">
          <Message align={isUser ? "end" : "start"} className="group">
            <MessageHeaderAvatar isUser={isUser} agentName={agentName} />
            <MessageContent>
              <div
                ref={bubbleRef}
                onMouseUp={handleMouseUp}
                className="relative flex w-full flex-col gap-2"
              >
                <MessageSelectionToolbar
                  position={selectionPosition}
                  selectedText={selectedText}
                  onReply={() => handleReplySelected()}
                />

                {isUser ? (
                  <div className="flex flex-col items-end gap-2">
                    <UserAttachments
                      images={images}
                      attachments={attachments}
                      onOpenArtifact={onOpenArtifact}
                    />
                    {text && (
                      <Bubble
                        variant="default"
                        align="end"
                        className="relative"
                      >
                        <BubbleContent className="whitespace-pre-wrap">
                          {text}
                        </BubbleContent>
                        <MessageReactions
                          reactions={reactions}
                          align="end"
                          isUser={true}
                          agentName={agentName}
                        />
                      </Bubble>
                    )}
                  </div>
                ) : (
                  <MessagePartsView
                    messageParts={messageParts}
                    reactions={reactions}
                    agentName={agentName}
                    onOpenArtifact={onOpenArtifact}
                    onReact={handleReaction}
                  />
                )}
              </div>

              <MessageActions
                isUser={isUser}
                createdAt={message.createdAt}
                onCopy={handleCopy}
                onShare={handleShare}
                copied={copied}
                shared={shared}
                onReact={handleReaction}
              />
            </MessageContent>
          </Message>
        </ContextMenuTrigger>

        <MessageContextMenuContent
          isUser={isUser}
          selectedText={selectedText}
          onCopy={handleCopy}
          onReply={handleReply}
          onShare={handleShare}
          onDownload={handleDownload}
          onReact={handleReaction}
          onClose={() => setIsContextOpen(false)}
        />
      </ContextMenu>
    )
  }
)
