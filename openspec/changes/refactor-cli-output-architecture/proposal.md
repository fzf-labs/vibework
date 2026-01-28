# Change: CLI 输出架构改造

## Why

当前 VibeWork 的 CLI 输出处理采用简单的字符串累积方式，存在以下问题：
1. **非实时性**：输出通过 IPC 事件逐行发送，但缺乏流式处理机制，大量输出时可能造成 UI 卡顿
2. **无结构化解析**：AI Agent 的 JSON 输出未被解析，无法区分工具调用、文件操作、消息等不同类型
3. **内存管理缺失**：输出无限累积在内存中，长时间运行的任务可能导致内存溢出
4. **多工具格式不统一**：不同 CLI 工具（claude-code、codex、gemini-cli）的输出格式各异，前端需要分别处理

参考 vibe-kanban 项目的 Rust+React 实现，需要在 Electron 架构下实现类似的实时流式输出和结构化日志解析能力。

## What Changes

### 主进程改造
- **新增 MsgStore 消息存储服务**：实现带容量限制的消息存储和广播机制
- **新增 LogNormalizer 日志标准化服务**：解析 AI Agent 的 JSON 输出，转换为统一的 NormalizedEntry 格式
- **改造 ClaudeCodeService**：集成 MsgStore，支持流式输出捕获和广播
- **扩展 IPC 通道**：新增流式日志订阅/取消订阅接口

### 渲染进程改造
- **新增 useLogStream Hook**：管理日志流订阅和状态
- **改造 TerminalOutput 组件**：支持 ANSI 颜色渲染和增量更新
- **新增 NormalizedLogView 组件**：展示结构化的日志条目（工具调用、文件操作等）

### 数据格式定义
- **定义 LogMsg 类型**：Stdout、Stderr、JsonPatch、Finished 等消息类型
- **定义 NormalizedEntry 类型**：统一的结构化日志条目格式
- **定义各 CLI 工具的输出解析器**：claude-code、codex、gemini-cli 等

## Impact

- **Affected specs**:
  - `cli-output-streaming` (新增)
  - `cli-log-normalization` (新增)
- **Affected code**:
  - `src/main/services/ClaudeCodeService.ts` - 集成消息存储
  - `src/main/services/CLIProcessService.ts` - 通用 CLI 进程管理
  - `src/preload/index.ts` - 新增 IPC 接口
  - `src/renderer/src/components/cli/TerminalOutput.tsx` - 渲染改造
  - `src/renderer/src/components/task/MessageList.tsx` - 结构化日志展示
  - `src/renderer/src/pages/TaskDetail.tsx` - 集成新的日志流
