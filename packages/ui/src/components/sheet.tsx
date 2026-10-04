"use client"

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { Button } from "@openbots/ui/components/button"
import { cn } from "cn"
import { ChevronLeft, X as XIcon } from "reicon-react"
import * as React from "react"

/* -------------------------------------------------------------------------- */
/*  Back button support                                                       */
/*                                                                            */
/*  While a sheet is open we push one history entry. The device/browser back  */
/*  button then pops that entry and closes the sheet instead of navigating.   */
/*  A single module-level listener + stack keeps nested sheets correct: back  */
/*  only closes the top-most one.                                             */
/* -------------------------------------------------------------------------- */

const SHEET_HISTORY_KEY = "__sheetOpen"

type HistoryEntry = { id: string; close: () => void }

const historyStack: HistoryEntry[] = []
// Number of popstate events caused by our own history.back() calls.
let skipPops = 0
let listening = false

function handlePopState() {
  if (skipPops > 0) {
    skipPops--
    return
  }
  // Device back: the entry is already gone, so just close the top sheet.
  historyStack.pop()?.close()
}

function acquireHistoryEntry(id: string, close: () => void) {
  if (!listening) {
    window.addEventListener("popstate", handlePopState)
    listening = true
  }
  historyStack.push({ id, close })
  // Spread the current state so routers (e.g. Next.js) keep their own data.
  window.history.pushState(
    { ...window.history.state, [SHEET_HISTORY_KEY]: id },
    ""
  )
}

function releaseHistoryEntry(id: string) {
  const index = historyStack.findIndex((entry) => entry.id === id)
  // Not in the stack: closed by the back button, entry already consumed.
  if (index === -1) return

  const wasTop = index === historyStack.length - 1
  historyStack.splice(index, 1)

  // Closed from the UI (X button, overlay, Escape, programmatically).
  // Remove our extra entry, but only if it is still the current one, so we
  // never undo a navigation the user made while the sheet was open.
  if (wasTop && window.history.state?.[SHEET_HISTORY_KEY] === id) {
    skipPops++
    window.history.back()
  }
}

function useCloseOnBack(open: boolean, enabled: boolean, close: () => void) {
  const id = React.useId()
  const closeRef = React.useRef(close)

  React.useEffect(() => {
    closeRef.current = close
  })

  React.useEffect(() => {
    if (!enabled || !open) return
    acquireHistoryEntry(id, () => closeRef.current())
    return () => releaseHistoryEntry(id)
  }, [enabled, open, id])
}

/* -------------------------------------------------------------------------- */

type SheetRootProps = SheetPrimitive.Root.Props & {
  /** Close the sheet when the user presses back. Default: true. */
  closeOnBack?: boolean
}

function Sheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  closeOnBack = true,
  ...props
}: SheetRootProps) {
  // We always render the primitive as controlled so we know the open state
  // in both controlled and uncontrolled usage.
  const [openState, setOpenState] = React.useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState

  const handleOpenChange = React.useCallback<
    NonNullable<SheetPrimitive.Root.Props["onOpenChange"]>
  >(
    (next, eventDetails) => {
      if (!isControlled) setOpenState(next)
      onOpenChange?.(next, eventDetails)
    },
    [isControlled, onOpenChange]
  )

  useCloseOnBack(open, closeOnBack, () => {
    if (!isControlled) setOpenState(false)
    // There is no Base UI event for a history pop, so no details are passed.
    onOpenChange?.(
      false,
      undefined as unknown as Parameters<
        NonNullable<SheetPrimitive.Root.Props["onOpenChange"]>
      >[1]
    )
  })

  return (
    <SheetPrimitive.Root
      data-slot="sheet"
      open={open}
      onOpenChange={handleOpenChange}
      {...props}
    />
  )
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal className={"dark"}>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 rounded-none border-0 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 sm:rounded-xl sm:border sm:shadow-xl",

          // bottom
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=bottom]:sm:inset-x-3 data-[side=bottom]:sm:bottom-3",

          // top
          "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=top]:sm:inset-x-3 data-[side=top]:sm:top-3",

          // left
          "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=left]:sm:inset-y-3 data-[side=left]:sm:left-3 data-[side=left]:sm:h-auto data-[side=left]:sm:w-auto data-[side=left]:sm:w-full data-[side=left]:sm:max-w-sm",

          // right
          "data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-full data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=right]:sm:inset-y-3 data-[side=right]:sm:right-3 data-[side=right]:sm:h-auto data-[side=right]:sm:w-auto data-[side=right]:sm:max-w-sm",

          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                className="absolute top-2 right-2 h-6.5 px-2 sm:size-6"
                size="sm"
              />
            }
          >
            <XIcon className="hidden sm:flex" />
            <ChevronLeft className="flex size-3.5 sm:hidden" />
            <span className="sr-only">Close</span>
            <span className="sm:hidden">Back</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading font-medium text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
