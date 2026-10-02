"use client";

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@openbots/ui/components/item";
import {
  IconChartDots3,
  IconCode,
  IconEye,
  IconVectorTriangle,
} from "@tabler/icons-react";
import type { ParsedArtifact } from "./parser";

interface ArtifactCardProps {
  artifact: ParsedArtifact;
  onClick: () => void;
}

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  const getIcon = () => {
    switch (artifact.type) {
      case "svg":
        return <IconVectorTriangle className="size-4" />;
      case "mermaid":
        return <IconChartDots3 className="size-4" />;
      default:
        return <IconCode className="size-4" />;
    }
  };

  return (
    <Item
      variant="outline"
      size="sm"
      onClick={onClick}
      className="my-1.5 cursor-pointer hover:bg-muted/50"
    >
      <ItemMedia variant="icon">{getIcon()}</ItemMedia>
      <ItemContent>
        <ItemTitle>{artifact.title}</ItemTitle>
        <ItemDescription>
          {artifact.type.toUpperCase()} · Click to inspect and preview
        </ItemDescription>
      </ItemContent>
      <ItemMedia variant="icon">
        <IconEye className="size-4 opacity-60" />
      </ItemMedia>
    </Item>
  );
}
