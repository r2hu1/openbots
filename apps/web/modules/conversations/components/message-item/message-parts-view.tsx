"use client"

import { Bubble, BubbleContent } from "@openbots/ui/components/bubble"
import * as React from "react"
import { Markdown } from "@/components/shared/markdown"
import { ArtifactCard } from "@/modules/artifacts/artifact-card"
import type { ParsedArtifact } from "@/modules/artifacts/parser"
import { MessageReactions } from "./message-reactions"

interface MessagePartItem {
  partId: string
  segments: Array<{
    id: string
    type: "text" | "artifact"
    text?: string
    artifact?: ParsedArtifact
  }>
}

interface MessagePartsViewProps {
  messageParts: MessagePartItem[]
  reactions: string[]
  agentName: string
  onOpenArtifact?: (artifact: ParsedArtifact) => void
  onReact?: (emoji: string, origin?: { x: number; y: number }) => void
}

export function MessagePartsView({
  messageParts,
  reactions,
  agentName,
  onOpenArtifact,
  onReact,
}: MessagePartsViewProps) {
  // Reorder segments so all text content appears first, and artifacts render at the end
  const orderedParts = React.useMemo(() => {
    return messageParts.map((part) => {
      const textSegments = part.segments.filter(
        (s) => s.type === "text" && s.text
      )
      const artifactSegments = part.segments.filter(
        (s) => s.type === "artifact" && s.artifact
      )
      return {
        ...part,
        segments: [...textSegments, ...artifactSegments],
      }
    })
  }, [messageParts])

  return (
    <>
      {orderedParts.map((part, partIndex) => {
        const isLastPart = partIndex === orderedParts.length - 1
        return (
          <React.Fragment key={part.partId}>
            {part.segments.map((seg, segIndex) => {
              const isVeryLastSegment =
                isLastPart && segIndex === part.segments.length - 1
              if (seg.text) {
                return (
                  <Bubble
                    key={seg.id}
                    variant="secondary"
                    align="start"
                    className="relative"
                  >
                    <BubbleContent className="typeset typeset-chat text-sm text-sidebar-foreground">
                      <Markdown>{seg.text}</Markdown>
                    </BubbleContent>
                    {isVeryLastSegment && (
                      <MessageReactions
                        reactions={reactions}
                        align="start"
                        isUser={false}
                        agentName={agentName}
                        onReact={onReact}
                      />
                    )}
                  </Bubble>
                )
              }
              if (seg.type === "artifact" && seg.artifact) {
                const artifact = seg.artifact
                const typeOfA = artifact.type
                if (!typeOfA) return null
                const isInlineVisual = artifact.mode === "inline"
                return (
                  <div key={seg.id} className={"relative w-full max-w-[80%]"}>
                    <ArtifactCard
                      artifact={artifact}
                      onClick={() => onOpenArtifact?.(artifact)}
                    />
                    {isVeryLastSegment && (
                      <MessageReactions
                        reactions={reactions}
                        align="start"
                        isUser={false}
                        agentName={agentName}
                        onReact={onReact}
                      />
                    )}
                  </div>
                )
              }
              return null
            })}
          </React.Fragment>
        )
      })}
    </>
  )
}
