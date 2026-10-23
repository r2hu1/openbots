"use client"

import * as React from "react"
import type { ParsedArtifact } from "./parser"

export interface ArtifactContextValue {
  selectedArtifact: ParsedArtifact | null
  openArtifact: (artifact: ParsedArtifact) => void
  closeArtifact: () => void
  toggleArtifact: (artifact: ParsedArtifact) => void
  isOpen: (artifact: ParsedArtifact) => boolean
}

export const ArtifactContext = React.createContext<ArtifactContextValue | null>(null)

export function ArtifactProvider({
  selectedArtifact,
  onOpenArtifact,
  onCloseArtifact,
  children,
}: {
  selectedArtifact: ParsedArtifact | null
  onOpenArtifact: (artifact: ParsedArtifact) => void
  onCloseArtifact: () => void
  children: React.ReactNode
}) {
  const isMatch = React.useCallback(
    (a: ParsedArtifact | null, b: ParsedArtifact | null) => {
      if (!a || !b) return false
      if (a.id && b.id && a.id === b.id) return true
      if (a.title && b.title && a.title === b.title && a.type === b.type) return true
      if (a.source && b.source && a.source === b.source) return true
      return false
    },
    []
  )

  const isOpen = React.useCallback(
    (artifact: ParsedArtifact) => isMatch(selectedArtifact, artifact),
    [selectedArtifact, isMatch]
  )

  const toggleArtifact = React.useCallback(
    (artifact: ParsedArtifact) => {
      if (isOpen(artifact)) {
        onCloseArtifact()
      } else {
        onOpenArtifact(artifact)
      }
    },
    [isOpen, onCloseArtifact, onOpenArtifact]
  )

  const value = React.useMemo<ArtifactContextValue>(
    () => ({
      selectedArtifact,
      openArtifact: onOpenArtifact,
      closeArtifact: onCloseArtifact,
      toggleArtifact,
      isOpen,
    }),
    [selectedArtifact, onOpenArtifact, onCloseArtifact, toggleArtifact, isOpen]
  )

  return (
    <ArtifactContext.Provider value={value}>
      {children}
    </ArtifactContext.Provider>
  )
}

export function useArtifact() {
  return React.useContext(ArtifactContext)
}
