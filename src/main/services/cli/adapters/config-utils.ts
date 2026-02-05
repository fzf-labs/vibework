export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const filtered = value.filter((entry) => typeof entry === 'string' && entry.trim()) as string[]
    return filtered.length > 0 ? filtered : undefined
  }
  const single = asString(value)
  return single ? [single] : undefined
}

export function pushFlag(args: string[], flag: string, enabled?: boolean): void {
  if (enabled) args.push(flag)
}

export function pushFlagWithValue(args: string[], flag: string, value: unknown): void {
  const resolved = asString(value)
  if (resolved) args.push(flag, resolved)
}

export function pushRepeatableFlag(args: string[], flag: string, values: unknown): void {
  const list = asStringArray(values)
  if (!list) return
  for (const entry of list) {
    args.push(flag, entry)
  }
}
