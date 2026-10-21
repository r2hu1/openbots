"use client"

import { cn } from "cn"
import * as React from "react"

export interface SheetResizeHandleProps {
  side: "left" | "right"
  onResize: (newWidth: number) => void
  onResizeEnd?: () => void
  minWidth?: number
  maxWidth?: number
  className?: string
}

export function SheetResizeHandle({
  side,
  onResize,
  onResizeEnd,
  minWidth = 550,
  maxWidth = 1000,
  className,
}: SheetResizeHandleProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const isDraggingRef = React.useRef(false)
  const startXRef = React.useRef(0)
  const startWidthRef = React.useRef(0)
  const onResizeRef = React.useRef(onResize)
  const onResizeEndRef = React.useRef(onResizeEnd)

  React.useEffect(() => {
    onResizeRef.current = onResize
    onResizeEndRef.current = onResizeEnd
  })

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      // Target current target element and capture pointer
      const target = e.currentTarget
      try {
        target.setPointerCapture(e.pointerId)
      } catch {}

      isDraggingRef.current = true
      setIsDragging(true)
      startXRef.current = e.clientX

      // Measure current sheet element width directly from DOM
      const sheetEl = target.closest(
        "[data-slot='sheet-content']"
      ) as HTMLElement | null
      const currentWidth = sheetEl
        ? sheetEl.getBoundingClientRect().width
        : side === "right"
          ? window.innerWidth - e.clientX
          : e.clientX
      startWidthRef.current = currentWidth

      // Disable text selection and transitions while dragging
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current) return
        const deltaX = moveEvent.clientX - startXRef.current
        const max = maxWidth ?? Math.floor(window.innerWidth * 0.9)
        let newWidth =
          side === "right"
            ? startWidthRef.current - deltaX
            : startWidthRef.current + deltaX

        newWidth = Math.max(minWidth, Math.min(newWidth, max))
        onResizeRef.current(newWidth)
      }

      const handlePointerUp = (upEvent: PointerEvent) => {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        setIsDragging(false)
        try {
          target.releasePointerCapture(upEvent.pointerId)
        } catch {}

        document.body.style.userSelect = ""
        document.body.style.cursor = ""

        onResizeEndRef.current?.()
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
        window.removeEventListener("pointercancel", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      })
      window.addEventListener("pointerup", handlePointerUp)
      window.addEventListener("pointercancel", handlePointerUp)
    },
    [side, minWidth, maxWidth]
  )

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      data-slot="sheet-resize-handle"
      data-dragging={isDragging ? "" : undefined}
      onPointerDown={handlePointerDown}
      className={cn(
        "group absolute inset-y-0 z-50 flex w-3 cursor-col-resize items-center justify-center select-none",
        side === "right" ? "-left-1.5" : "-right-1.5",
        className
      )}
    >
      <div
        className={cn(
          "relative flex h-full w-1 items-center justify-center ring-offset-background transition-colors",
          "after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2",
          isDragging && "bg-primary/20"
        )}
      >
        <div
          className={cn(
            "z-10 flex h-6 w-1 shrink-0 rounded-lg transition-colors",
            "group-hover:bg-primary/80",
            isDragging && "bg-primary"
          )}
        />
      </div>
    </div>
  )
}
