export const KNOWN_CRONS: Record<string, string> = {
  "0 9 * * *": "Every day at 9:00 AM",
  "0 0 * * *": "Every day at midnight",
  "0 12 * * *": "Every day at noon",
  "*/15 * * * *": "Every 15 minutes",
  "*/30 * * * *": "Every 30 minutes",
  "0 * * * *": "Every hour",
  "0 9 * * 1": "Every Monday at 9:00 AM",
  "0 9 * * 1-5": "Every weekday at 9:00 AM",
}

export function formatCronReadable(cron: string): string {
  const trimmed = cron.trim()
  if (KNOWN_CRONS[trimmed]) {
    return KNOWN_CRONS[trimmed]!
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 5) {
    const [min, hour, dayOfMonth, month, dayOfWeek] = parts
    const h = parseInt(hour ?? "", 10)
    const m = parseInt(min ?? "", 10)

    if (!isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? "PM" : "AM"
      const displayHour = h % 12 === 0 ? 12 : h % 12
      const displayMin = m < 10 ? `0${m}` : `${m}`
      const timeStr = `${displayHour}:${displayMin} ${ampm}`

      if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        return `Every day at ${timeStr}`
      }
      if (dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
        return `Every weekday at ${timeStr}`
      }
    }
  }

  return trimmed
}
