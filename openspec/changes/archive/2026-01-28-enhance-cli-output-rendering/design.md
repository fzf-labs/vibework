# Design: CLI 输出渲染增强

## Context

VibeWork 已实现基础的 CLI 输出流式处理（MsgStore + LogNormalizer），但在大量日志场景下存在性能问题。参考 vibe-kanban 的 Rust+React 实现，需要在 Electron 架构下补充虚拟化渲染和消息批处理能力。

### 约束条件
- 基于现有 MsgStoreService 扩展，不重构核心架构
- 保持与现有 IPC 通信方式兼容
- 前端组件需要向后兼容现有的 TerminalOutput 使用方式

## Goals / Non-Goals

### Goals
1. 支持 10000+ 条日志的流畅渲染（60fps）
2. 减少 IPC 消息频率至少 50%
3. 完整支持 ANSI 256 色和样式
4. 提供按行分割的 stdout 流

### Non-Goals
- 不实现交互式终端（PTY）
- 不修改现有的 NormalizedEntry 数据结构
- 不引入 WebSocket 通信

## Decisions

### Decision 1: 使用 react-virtuoso 实现虚拟化

**选择**: 使用 `react-virtuoso` 库实现虚拟化列表

**理由**:
- 专为消息列表场景优化，支持自动滚动到底部
- 支持动态高度的列表项
- 与 vibe-kanban 使用的 `@virtuoso.dev/message-list` 同源
- 社区活跃，文档完善

**替代方案**:
- `react-window`: 不支持动态高度，需要额外计算
- `@virtuoso.dev/message-list`: 需要商业许可证

### Decision 2: 主进程数据批处理

**选择**: 在主进程实现 DataBatcher，合并短时间内的消息

**理由**:
- 减少 IPC 调用频率，降低进程间通信开销
- 在数据源头批处理，比前端节流更高效
- 可配置的时间窗口和数据量阈值

**批处理策略**:
```typescript
interface BatcherConfig {
  flushIntervalMs: number  // 默认 16ms (60fps)
  maxBatchBytes: number    // 默认 200KB
}
```

### Decision 3: 使用 fancy-ansi 渲染 ANSI 颜色

**选择**: 使用 `fancy-ansi` 库解析和渲染 ANSI 转义码

**理由**:
- 支持完整的 ANSI 256 色和 RGB 真彩色
- 提供 React 组件 `<AnsiHtml>`，集成简单
- 与 vibe-kanban 使用相同的库，保持一致性

**替代方案**:
- `ansi-to-html`: 功能较基础，不支持真彩色
- 自定义解析器: 维护成本高，容易遗漏边界情况

## Architecture

### 数据流增强

```
┌─────────────────────────────────────────────────────────────┐
│                      主进程 (Main Process)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CLI stdout/stderr                                          │
│       │                                                     │
│       ▼                                                     │
│  DataBatcher (新增)                                          │
│  ├── 时间批处理: 16ms 窗口                                    │
│  ├── 大小批处理: 200KB 阈值                                   │
│  └── UTF-8 多字节字符处理                                     │
│       │                                                     │
│       ▼                                                     │
│  MsgStore (增强)                                             │
│  ├── push() - 现有                                          │
│  ├── historyPlusStream() - 新增                             │
│  └── stdoutLinesStream() - 新增                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │ IPC (批量消息)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    渲染进程 (Renderer Process)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  useLogStream Hook                                          │
│       │                                                     │
│       ▼                                                     │
│  VirtualizedLogList (新增)                                   │
│  ├── react-virtuoso 虚拟化                                   │
│  ├── 自动滚动到底部                                          │
│  └── 动态高度支持                                            │
│       │                                                     │
│       ▼                                                     │
│  LogItem                                                    │
│  └── AnsiHtml (fancy-ansi)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块设计

#### 1. DataBatcher (数据批处理器)

**文件位置**: `src/main/services/DataBatcher.ts`

```typescript
class DataBatcher {
  private buffer: string = ''
  private decoder: StringDecoder
  private timeout: NodeJS.Timeout | null = null
  private onFlush: (data: string) => void

  constructor(onFlush: (data: string) => void, config?: BatcherConfig)
  write(data: Buffer | string): void
  flush(): void
  destroy(): void
}
```

#### 2. MsgStoreService 增强

**新增方法**:

```typescript
// 历史 + 实时流组合
historyPlusStream(): Observable<LogMsg>

// stdout 按行分割流
stdoutLinesStream(): Observable<string>
```

#### 3. VirtualizedLogList 组件

**文件位置**: `src/renderer/src/components/cli/VirtualizedLogList.tsx`

```typescript
interface VirtualizedLogListProps {
  logs: LogEntry[]
  autoScroll?: boolean
  searchQuery?: string
}

function VirtualizedLogList(props: VirtualizedLogListProps): JSX.Element
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 批处理延迟 | 16ms 延迟可能影响实时感 | 可配置阈值，紧急消息立即刷新 |
| 虚拟化滚动跳跃 | 快速滚动时可能出现空白 | 增加 overscan 缓冲区 |
| fancy-ansi 包体积 | 增加约 50KB | 按需加载，仅在需要时引入 |

## Open Questions

1. 是否需要支持日志搜索高亮？
2. 批处理阈值是否需要用户可配置？
3. 是否需要支持日志导出功能？
