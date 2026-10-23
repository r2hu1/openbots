"use client"

import {
  type ArtifactCardProps,
  ArtifactIcon,
  ArtifactPreview,
  useCopy,
  useThumbnailFrame,
} from "./components/artifact-card-common"
import { CardArtifact } from "./components/card-artifact"
import { FileArtifact } from "./components/file-artifact"
import { InlineArtifact } from "./components/inline-artifact"

export * from "./artifact-context"

export {
  type ArtifactCardProps,
  ArtifactIcon,
  ArtifactPreview,
  useCopy,
  useThumbnailFrame,
}

export function ArtifactCard(props: ArtifactCardProps) {
  if (props.artifact.type === "file") {
    return <FileArtifact {...props} />
  }

  return props.artifact.mode === "inline" ? (
    <InlineArtifact {...props} />
  ) : (
    <CardArtifact {...props} />
  )
}
