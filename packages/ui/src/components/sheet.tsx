"use client"

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { Button } from "@openbots/ui/components/button"
import { cn } from "cn"
import * as React from "react"
import { ChevronLeft, X as XIcon } from "reicon-react"
import { SheetResizeHandle } from "@openbots/ui/components/sheet-resize-handle"

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
/*  Variants + provider                                                       */
/* -------------------------------------------------------------------------- */

type SheetVariant = "floating" | "sidebar"
type SheetSide = "top" | "right" | "bottom" | "left"

// Matches Tailwind's `md` breakpoint, which the provider padding also uses.
const DESKTOP_QUERY = "(min-width: 48rem)"

function subscribeDesktop(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

// Server and first hydration render as mobile (floating), then sync.
function useIsDesktop() {
  return React.useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  )
}

const SheetContext = React.createContext<{
  variant: SheetVariant
  open: boolean
}>({
  variant: "floating",
  open: false,
})

const SheetProviderContext = React.createContext<{
  setSidebarSide: (side: "left" | "right" | null) => void
  sidebarWidth: string
  setSidebarWidth: (width: string) => void
} | null>(null)

// Content renders in a portal (outside the provider div), so the CSS var
// doesn't inherit; share the width via context instead.
const SheetWidthContext = React.createContext("20rem")

/** Wrap your app body. Pushes content aside (md+) while a sidebar sheet is open. */
function SheetProvider({
  width = "20rem",
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { width?: string }) {
  const [side, setSide] = React.useState<"left" | "right" | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState(width)

  // Keep in sync if width prop changes
  React.useEffect(() => {
    setSidebarWidth(width)
  }, [width])

  const value = React.useMemo(
    () => ({
      setSidebarSide: setSide,
      sidebarWidth,
      setSidebarWidth,
    }),
    [sidebarWidth]
  )

  return (
    <SheetProviderContext.Provider value={value}>
      <SheetWidthContext.Provider value={sidebarWidth}>
        <div
          data-slot="sheet-provider"
          data-sidebar-side={side ?? undefined}
          style={
            {
              "--sheet-width": sidebarWidth,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "transition-[padding] duration-100 ease-[cubic-bezier(0.32,0.72,0,1)] md:data-[sidebar-side=left]:pl-[calc(var(--sheet-width)+1.5rem)] md:data-[sidebar-side=right]:pr-[calc(var(--sheet-width)+0.7rem)]",
            className
          )}
          {...props}
        />
      </SheetWidthContext.Provider>
    </SheetProviderContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */

type SheetRootProps = SheetPrimitive.Root.Props & {
  /**
   * "floating" (modal, inset card) or "sidebar" (docked, non-modal, pushes
   * content). Sidebar only applies on desktop (md+); mobile is always
   * floating. Default: floating.
   */
  variant?: SheetVariant
  /** Close on device back. Default: true when floating, false when sidebar. */
  closeOnBack?: boolean
}

function Sheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  variant: variantProp = "floating",
  closeOnBack,
  ...props
}: SheetRootProps) {
  const isDesktop = useIsDesktop()
  // Mobile is always floating.
  const variant: SheetVariant =
    variantProp === "sidebar" && isDesktop ? "sidebar" : "floating"

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

  useCloseOnBack(open, closeOnBack ?? variant === "floating", () => {
    if (!isControlled) setOpenState(false)
    // There is no Base UI event for a history pop, so no details are passed.
    onOpenChange?.(
      false,
      undefined as unknown as Parameters<
        NonNullable<SheetPrimitive.Root.Props["onOpenChange"]>
      >[1]
    )
  })

  const ctx = React.useMemo(() => ({ variant, open }), [variant, open])

  return (
    <SheetContext.Provider value={ctx}>
      <SheetPrimitive.Root
        data-slot="sheet"
        modal={variant === "floating"}
        disablePointerDismissal={variant === "sidebar"}
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </SheetContext.Provider>
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
  alwaysDark = true,
  resizable = true,
  minWidth,
  maxWidth,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: SheetSide
  showCloseButton?: boolean
  alwaysDark?: boolean
  resizable?: boolean
  minWidth?: number
  maxWidth?: number
}) {
  const { variant, open } = React.useContext(SheetContext)
  const provider = React.useContext(SheetProviderContext)
  const width = React.useContext(SheetWidthContext)

  // Sidebar only makes sense on left/right; top/bottom fall back to floating.
  const sidebarSide =
    variant === "sidebar" && (side === "left" || side === "right") ? side : null

  // SheetContent stays mounted while closed, so gate on `open` to
  // release the reserved space when the sheet closes.
  React.useEffect(() => {
    if (!provider || !sidebarSide || !open) return
    provider.setSidebarSide(sidebarSide)
    return () => provider.setSidebarSide(null)
  }, [provider, sidebarSide, open])

  const handleResize = React.useCallback(
    (newWidthPx: number) => {
      provider?.setSidebarWidth(`${newWidthPx}px`)
    },
    [provider]
  )

  return (
    <SheetPortal className={cn(alwaysDark && "dark")}>
      {!sidebarSide && <SheetOverlay />}
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        data-variant={sidebarSide ? "sidebar" : "floating"}
        style={sidebarSide ? { width, maxWidth: "none" } : undefined}
        className={cn(
          "fixed z-50 flex flex-col gap-4 border bg-popover bg-clip-padding text-sm text-popover-foreground",

          // Positions (shared)
          "data-[side=bottom]:inset-x-3 data-[side=bottom]:bottom-3 data-[side=bottom]:max-h-[85dvh] data-[side=bottom]:rounded-xl",
          "data-[side=top]:inset-x-3 data-[side=top]:top-3 data-[side=top]:max-h-[85dvh] data-[side=top]:rounded-xl",
          "data-[side=left]:inset-y-3 data-[side=left]:left-3 data-[side=left]:rounded-xl",
          "data-[side=right]:inset-y-3 data-[side=right]:right-3 data-[side=right]:rounded-xl",

          sidebarSide
            ? [
                // Full slide, no fade, synced with the provider padding
                "max-w-none! transition-[translate] duration-100 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                "data-[side=left]:data-ending-style:-translate-x-[calc(100%+0.75rem)] data-[side=left]:data-starting-style:-translate-x-[calc(100%+0.75rem)]",
                "data-[side=right]:data-ending-style:translate-x-[calc(100%+0.75rem)] data-[side=right]:data-starting-style:translate-x-[calc(100%+0.75rem)]",
              ]
            : [
                "transition duration-100 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
                "data-[side=bottom]:data-ending-style:translate-y-4 data-[side=bottom]:data-starting-style:translate-y-4",
                "data-[side=top]:data-ending-style:-translate-y-4 data-[side=top]:data-starting-style:-translate-y-4",
                "data-[side=left]:max-w-sm data-[side=left]:data-ending-style:-translate-x-4 data-[side=left]:data-starting-style:-translate-x-4",
                "data-[side=right]:max-w-[95%] data-[side=right]:data-ending-style:translate-x-4 data-[side=right]:data-starting-style:translate-x-4 sm:data-[side=right]:max-w-sm",
              ],

          className
        )}
        {...props}
      >
        {sidebarSide && resizable && (
          <SheetResizeHandle
            side={sidebarSide}
            onResize={handleResize}
            minWidth={minWidth}
            maxWidth={maxWidth}
          />
        )}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                className="absolute top-2 right-2 size-6"
                size="icon-xs"
                variant="secondary"
              />
            }
          >
            <XIcon className="size-3.5" />
            <span className="sr-only">Close</span>
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
  SheetProvider,
  SheetTitle,
  SheetTrigger,
}
