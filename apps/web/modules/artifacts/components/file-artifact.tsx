"use client"

import {
  ArtifactCard,
  type ArtifactCardProps,
  SharedArtifactCard,
} from "../artifact-card"

/**
 * @deprecated Use ArtifactCard or SharedArtifactCard directly from @/modules/artifacts/artifact-card
 */
export function FileArtifact(props: ArtifactCardProps) {
  return <SharedArtifactCard {...props} />
}
