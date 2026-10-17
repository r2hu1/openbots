import { cn } from "@/lib/utils"
import * as React from "react"

export const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]"

export const DESTRUCTIVE_ACTION_CLASS =
  "text-destructive-foreground bg-destructive hover:bg-destructive/90"

export type Feedback = { type: "success" | "error"; message: string }

export function useStoredBoolean(key: string, initial: boolean) {
  const [value, setValue] = React.useState(initial)

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) setValue(stored === "true")
    } catch {}
  }, [key])

  const update = React.useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        localStorage.setItem(key, String(next))
      } catch {}
    },
    [key]
  )

  return [value, update] as const
}

export function useAutoClear(
  value: Feedback | null,
  clear: () => void,
  delay = 3000
) {
  React.useEffect(() => {
    if (!value) return
    const id = setTimeout(clear, delay)
    return () => clearTimeout(id)
  }, [value, clear, delay])
}

export function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

export function GroupLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h3
      className={cn(
        "mb-2 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </h3>
  )
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border border-border",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function StatusMessage({
  type,
  children,
}: {
  type: "success" | "error"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs",
        type === "success"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-destructive/20 bg-destructive/5 text-destructive"
      )}
    >
      {children}
    </div>
  )
}
