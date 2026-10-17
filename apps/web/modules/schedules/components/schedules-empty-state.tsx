"use client"

import * as React from "react"
import { Calendar2Newicons } from "reicon-react"

export function SchedulesEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Calendar2Newicons className="mx-auto mb-3 size-7 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground">Nothing scheduled</p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Ask your agent in chat, like &ldquo;Remind me to review notes in 10
        minutes&rdquo; or &ldquo;Send a daily report every day at 9am&rdquo;.
      </p>
    </div>
  )
}
