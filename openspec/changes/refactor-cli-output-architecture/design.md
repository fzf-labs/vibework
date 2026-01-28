# Design: CLI 输出架构改造

## Context

VibeWork 是一个基于 Electron + React + TypeScript 的桌面应用，用于管理多个 AI Agent CLI 工具。当前架构通过 IPC 事件将 CLI 输出从主进程发送到渲染进程，但缺乏流式处理、结构化解析和内存管理能力。

参考项目 vibe-kanban 使用 Rust 后端 + React 前端 + WebSocket 通信，实现了完整的实时日志流水线。本设计需要在 Electron 架构下实现类似能力。

### 约束条件
- 保持现有 Electron IPC 通信方式，不引入 WebSocket
- 支持多种 CLI 工具（claude-code、codex、gemini-cli 等）
- 兼容现有的数据库 schema 和 UI 组件

## Goals / Non-Goals

### Goals
1. 实现实时流式输出，支持增量更新和自动滚动
2. 解析 AI Agent 的 JSON 输出为结构化的 NormalizedEntry
3. 实现带容量限制的消息存储，防止内存溢出
4. 统一多种 CLI 工具的输出格式
5. 支持 ANSI 颜色码渲染

### Non-Goals
- 不实现交互式终端（xterm.js）
- 不引入 WebSocket 通信
- 不修改数据库 schema

## Decisions

### Decision 1: 使用 EventEmitter 实现消息广播

**选择**: 在主进程中使用 Node.js EventEmitter 实现消息广播机制

**理由**:
- Electron 主进程是 Node.js 环境，EventEmitter 是原生支持的高性能事件系统
- 相比 WebSocket，IPC + EventEmitter 更符合 Electron 架构
- 可以实现类似 vibe-kanban 中 broadcast channel 的功能

**替代方案**:
- WebSocket Server：需要额外的端口管理，增加复杂度
- RxJS Observable：引入额外依赖，学习成本高

### Decision 2: 消息存储采用环形缓冲区

**选择**: 使用固定大小的环形缓冲区存储历史消息，默认限制 50MB

**理由**:
- 防止长时间运行的任务导致内存溢出
- 新消息自动淘汰旧消息，无需手动清理
- 支持历史回放 + 实时流的组合

**实现**:
```typescript
interface MsgStoreConfig {
  maxBytes: number  // 默认 50MB
  maxMessages: number  // 默认 10000 条
}
```

### Decision 3: 统一的 NormalizedEntry 格式

**选择**: 定义统一的结构化日志条目格式，各 CLI 工具通过适配器转换

**理由**:
- 前端只需处理一种数据格式
- 便于扩展新的 CLI 工具支持
- 与 vibe-kanban 的设计保持一致

**数据结构**:
```typescript
type NormalizedEntryType =
  | 'assistant_message'
  | 'user_message'
  | 'system_message'
  | 'tool_use'
  | 'tool_result'
  | 'command_run'
  | 'file_edit'
  | 'file_read'
  | 'error'

interface NormalizedEntry {
  id: string
  type: NormalizedEntryType
  timestamp: number
  content: string
  metadata?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
    exitCode?: number
    filePath?: string
    status?: 'pending' | 'running' | 'success' | 'failed'
  }
}
```

## Architecture

### 整体数据流

```
┌──────────────────────────────────────────────────────────────────┐
│                         主进程 (Main Process)                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CLI 进程 (Claude Code / Codex / Gemini CLI)                   │
│     │                                                            │
│     ├─→ stdout ─┐                                                │
│     │           │                                                │
│     └─→ stderr ─┼─→ 2. MsgStore (环形缓冲区 + EventEmitter)        │
│                 │        │                                       │
│                 │        ├─→ LogMsg.Stdout(content)              │
│                 │        ├─→ LogMsg.Stderr(content)              │
│                 │        └─→ LogMsg.Normalized(entry)            │
│                 │                                                │
│                 └─→ 3. LogNormalizer 解析 JSON 输出               │
│                           │                                      │
│                           └─→ NormalizedEntry (结构化数据)        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC (ipcMain.handle / webContents.send)
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                       渲染进程 (Renderer Process)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  useLogStream Hook                                               │
│     │                                                            │
│     └─→ IPC 订阅 session 的日志流                                 │
│           │                                                      │
│           └─→ 接收 LogMsg 消息                                    │
│                  │                                               │
│                  └─→ 更新 logs 状态                               │
│                                                                  │
│  TerminalOutput / NormalizedLogView (渲染)                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 核心模块设计

#### 1. MsgStore (消息存储服务)

**文件位置**: `src/main/services/MsgStoreService.ts`

```typescript
class MsgStore extends EventEmitter {
  private history: StoredMsg[]
  private totalBytes: number
  private config: MsgStoreConfig

  push(msg: LogMsg): void
  getHistory(): LogMsg[]
  subscribe(callback: (msg: LogMsg) => void): () => void
  clear(): void
}
```

#### 2. LogNormalizer (日志标准化服务)

**文件位置**: `src/main/services/LogNormalizerService.ts`

```typescript
interface LogNormalizerAdapter {
  toolId: string
  parse(line: string): NormalizedEntry | null
}

class LogNormalizerService {
  private adapters: Map<string, LogNormalizerAdapter>

  registerAdapter(adapter: LogNormalizerAdapter): void
  normalize(toolId: string, line: string): NormalizedEntry | null
}
```

#### 3. IPC 接口扩展

**新增 IPC 通道**:

```typescript
// 主进程 handlers
ipcMain.handle('logStream:subscribe', (event, sessionId: string) => void)
ipcMain.handle('logStream:unsubscribe', (event, sessionId: string) => void)
ipcMain.handle('logStream:getHistory', (event, sessionId: string) => LogMsg[])

// 渲染进程事件
'logStream:message' // (sessionId: string, msg: LogMsg) => void
'logStream:finished' // (sessionId: string) => void
```

#### 4. 前端 Hook

**文件位置**: `src/renderer/src/hooks/useLogStream.ts`

```typescript
interface UseLogStreamResult {
  rawLogs: LogEntry[]
  normalizedLogs: NormalizedEntry[]
  isConnected: boolean
  error: string | null
}

function useLogStream(sessionId: string): UseLogStreamResult
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 内存限制可能丢失早期日志 | 长时间任务的历史日志不完整 | 提供导出功能，允许用户保存完整日志 |
| JSON 解析失败 | 部分输出无法结构化 | 降级为原始文本显示，记录解析错误 |
| IPC 消息积压 | 高频输出时可能造成延迟 | 实现消息批处理，合并短时间内的多条消息 |
| 多工具适配器维护成本 | 新工具需要开发适配器 | 提供通用适配器模板，文档化开发流程 |

## Migration Plan

### 阶段 1: 基础设施
1. 实现 MsgStore 服务
2. 实现 LogNormalizer 服务框架
3. 添加 Claude Code 适配器

### 阶段 2: 集成改造
1. 改造 ClaudeCodeService 集成 MsgStore
2. 扩展 IPC 接口
3. 更新 preload 暴露的 API

### 阶段 3: 前端改造
1. 实现 useLogStream Hook
2. 改造 TerminalOutput 组件
3. 新增 NormalizedLogView 组件

### 阶段 4: 扩展支持
1. 添加 Codex 适配器
2. 添加 Gemini CLI 适配器
3. 完善错误处理和降级逻辑

### 回滚方案
- 保留现有的 `output` 事件机制作为降级方案
- 通过配置开关控制是否启用新的流式输出

## Open Questions

1. 是否需要支持日志持久化到文件？
2. 消息批处理的时间窗口应该设置为多少？（建议 16ms，即一帧）
3. 是否需要支持日志搜索和过滤功能？
