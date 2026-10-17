"use client"

import { MessageAvatar } from "@openbots/ui/components/message"
import { Blobatar } from "@openbots/ui/components/ui/blobatar"
import * as React from "react"

interface MessageHeaderAvatarProps {
  isUser: boolean
  agentName: string
}

export function MessageHeaderAvatar({ isUser, agentName }: MessageHeaderAvatarProps) {
  if (isUser) return null

  return (
    <MessageAvatar className="-mr-0.5">
      <Blobatar name={agentName} className="size-8" />
    </MessageAvatar>
  )
}
