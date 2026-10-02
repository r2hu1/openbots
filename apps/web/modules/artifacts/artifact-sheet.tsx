"use client"

import { Button } from "@openbots/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openbots/ui/components/tabs"
import { IconCheck, IconCopy, IconMaximize, IconX } from "@tabler/icons-react"
import * as React from "react"
import type { ParsedArtifact } from "./parser"
import { HtmlSandbox, MermaidSandbox, SvgSandbox } from "./sandboxes"
import { cn } from "@/lib/utils"

interface ArtifactSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  artifact: ParsedArtifact | null
}

export function ArtifactSheet({
  open,
  onOpenChange,
  artifact,
}: ArtifactSheetProps) {
  const [copied, setCopied] = React.useState(false)
  const [maximized, setMaximized] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    if (!artifact?.content) return
    try {
      await navigator.clipboard.writeText(artifact.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy code:", err)
    }
  }, [artifact])

  if (!artifact) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        side="right"
        className={cn("w-full md:max-w-3xl!", maximized && "max-w-full!")}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            {artifact.title}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setMaximized(!maximized)}
              >
                <IconMaximize className="size-3" />
              </Button>
              <Button variant="outline" size="xs" onClick={handleCopy}>
                {copied ? (
                  <>
                    <IconCheck className="size-3" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy className="size-3" />
                    <span>Copy code</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => onOpenChange(false)}
              >
                <IconX className="size-3" />
              </Button>
            </div>
          </SheetTitle>
          <SheetDescription>
            {artifact.type.toUpperCase()} artifact preview & code
          </SheetDescription>
        </SheetHeader>

        <div className="-mt-3 flex flex-1 flex-col overflow-hidden p-4 pt-0">
          <Tabs
            defaultValue="preview"
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList variant="line" className="mb-3">
              <TabsTrigger value="preview">Live Preview</TabsTrigger>
              <TabsTrigger value="code">Source Code</TabsTrigger>
            </TabsList>

            <TabsContent
              value="preview"
              className="flex flex-1 flex-col overflow-hidden"
            >
              {artifact.type === "html" && (
                <HtmlSandbox code={artifact.content} />
              )}
              {artifact.type === "svg" && <SvgSandbox svg={artifact.content} />}
              {artifact.type === "mermaid" && (
                <MermaidSandbox code={artifact.content} />
              )}
            </TabsContent>

            <TabsContent
              value="code"
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-auto rounded-md border border-border bg-sidebar p-3 font-mono text-xs leading-relaxed text-foreground">
                <pre className="whitespace-pre-wrap">{artifact.content}</pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
