import { CliCompletionSignal } from '../types'

export function parseJsonLine(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line) as Record<string, unknown>
  } catch {
    return null
  }
}

export function successSignal(reason?: string): CliCompletionSignal {
  return { status: 'success', reason }
}

export function failureSignal(reason?: string): CliCompletionSignal {
  return { status: 'failure', reason }
}
