/**
 * CLI 输出日志类型定义
 */

// 日志消息类型
export type LogMsgType = 'stdout' | 'stderr' | 'normalized' | 'finished'

export interface LogMsgBase {
  id: string
  task_id: string
  session_id: string
  created_at: string
  schema_version: string
  meta?: Record<string, unknown>
}

export interface LogMsgStdout extends LogMsgBase {
  type: 'stdout'
  content: string
  timestamp?: number
}

export interface LogMsgStderr extends LogMsgBase {
  type: 'stderr'
  content: string
  timestamp?: number
}

export interface LogMsgNormalized extends LogMsgBase {
  type: 'normalized'
  entry: NormalizedEntry
  timestamp?: number
}

export interface LogMsgFinished extends LogMsgBase {
  type: 'finished'
  exit_code?: number
  timestamp?: number
}

export type LogMsg = LogMsgStdout | LogMsgStderr | LogMsgNormalized | LogMsgFinished

export type LogMsgInput = Omit<LogMsg, keyof LogMsgBase> & Partial<LogMsgBase>

// 标准化日志条目类型
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

// 工具状态
export type ToolStatus = 'pending' | 'running' | 'success' | 'failed'

// 标准化日志条目元数据
export interface NormalizedEntryMetadata {
  toolName?: string
  toolInput?: Record<string, unknown>
  toolOutput?: string
  exitCode?: number
  filePath?: string
  status?: ToolStatus
  toolUseId?: string
}

// 标准化日志条目
export interface NormalizedEntry {
  id: string
  type: NormalizedEntryType
  timestamp: number
  content: string
  metadata?: NormalizedEntryMetadata
}

// MsgStore 配置
export interface MsgStoreConfig {
  maxBytes: number // 默认 50MB
  maxMessages: number // 默认 10000 条
}

// 存储的消息（带大小信息）
export interface StoredMsg {
  msg: LogMsg
  bytes: number
}
