export type NormalizedEntryType =
  | 'assistant_message'
  | 'user_message'
  | 'system_message'
  | 'tool_use'
  | 'tool_result'
  | 'command_run'
  | 'file_edit'
  | 'file_read'
  | 'error'

export interface NormalizedEntry {
  id: string
  type: NormalizedEntryType
  timestamp: number
  content: string
  metadata?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
    toolUseId?: string
    status?: 'pending' | 'running' | 'success' | 'failed'
    filePath?: string
    command?: string
    exitCode?: number
    success?: boolean
    [key: string]: unknown
  }
}
