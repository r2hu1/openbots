export type ToolCallRecord = {
  name: string
  ok: boolean
  result?: unknown
}

const CLAIM_PATTERNS: { re: RegExp; tools: RegExp }[] = [
  {
    re: /\b(sent|emailed|posted|published|messaged)\b/i,
    tools: /(send|post|publish|reply|create_draft|message)/i,
  },
  {
    re: /\b(scheduled|reminder (is )?set|set a reminder)\b/i,
    tools: /(schedule|recurring)/i,
  },
  {
    re: /\b(saved|created (the )?file|uploaded)\b/i,
    tools: /(file|save|upload|write)/i,
  },
  {
    re: /\b(deleted|removed|cancel(l)?ed)\b/i,
    tools: /(delete|remove|cancel|manage_schedule)/i,
  },
  { re: /!\[[^\]]*\]\(([^)]+)\)/, tools: /(screenshot)/i },
]

export function findUnverifiedClaims(
  finalText: string,
  toolCalls: ToolCallRecord[]
): string[] {
  const unverified: string[] = []
  for (const { re, tools } of CLAIM_PATTERNS) {
    if (!re.test(finalText)) continue
    const verified = toolCalls.some((c) => c.ok && tools.test(c.name))
    if (!verified) unverified.push(re.source)
  }
  return unverified
}
