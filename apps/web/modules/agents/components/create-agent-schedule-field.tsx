"use client"

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@openbots/ui/components/field"
import { Textarea } from "@openbots/ui/components/textarea"
import * as React from "react"

interface CreateAgentScheduleFieldProps {
  value: string
  onChange: (value: string) => void
}

export function CreateAgentScheduleField({
  value,
  onChange,
}: CreateAgentScheduleFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor="scheduledTask">
        Scheduled Task (optional)
      </FieldLabel>
      <Textarea
        id="scheduledTask"
        rows={2}
        className="text-xs"
        placeholder="e.g. check my emails everyday at 9am, summarize crypto daily, or remind me..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldDescription className="text-[11px]">
        Add a task in everyday language. OpenBots will set up the recurring schedule in the background.
      </FieldDescription>
    </Field>
  )
}
