整体架构（统一完成信号，适配所有 CLI）

  A. 新增统一服务：CliSessionService

  - 位置建议：src/main/services/cli/CliSessionService.ts
  - 统一管理：sessionId / toolId / process / status / msgStore / completionOverride
  - 提供 IPC：cliSession:start|stop|sendInput|getSession|getSessions
  - 维护 MsgStore + logStream（替代仅 claude 的日志流）

  B. CLI Adapter 接口

  - 位置建议：src/main/services/cli/adapters/*.ts
  - 每个 CLI 实现：
      - buildCommand()（含 JSON/协议参数）
      - detectCompletion(line|event)（成功/失败）
      - supportsInteractive / sendInput
      - normalizeLog（可选）
  - 在 CliSessionService 中统一解析 JSON 行 → 触发 completion → 强制 kill → emit forcedSuccess

  C. Renderer 统一组件

  - ClaudeCodeSession 改成通用 CLISession
    位置建议：src/renderer/src/components/cli/CLISession.tsx
  - TaskDetail.tsx 不再只 useClaudeCli，改为：
      - 有 task.cli_tool_id 就显示 CLISession
      - onStatusChange 仍复用 markExecutionRunning/Completed
  - logStream 从 cliSession 获取，不再绑定 claude only

  D. 兼容层

  - claudeCode:* IPC 保留，但内部转调 cliSession:*（toolId 固定为 claude-code）
  - 这样老 UI/旧逻辑不会立刻崩

  ———

  ## 每个 CLI 的 JSON 模式 & detector 规则（直接对齐 vibe‑kanban）

  > 原则：只解析 JSON 行，避免误判；解析到完成就 强制结束进程，让 running → stopped/error 立即生效。

  ### 1) claude‑code

  JSON 模式（已在 vibework）：
  -p --output-format=stream-json --input-format=stream-json --verbose
  detector：

  - { type:"result", subtype:"success" } → success
  - { type:"result", subtype:"error" } 或 is_error:true → failure
  - { type:"error" } → failure

  ### 2) cursor‑agent

  JSON 模式（需要加）：
  -p --output-format=stream-json
  （vibe‑kanban 的 cursor executor 就这样）
  detector：

  - JSON 有 type:"result" → completion
  - 若带 status: success|completed → success，error|failed → failure
  - 若 is_error:true → failure

  ### 3) gemini‑cli

  JSON 模式（vibe‑kanban 方式）：
  --experimental-acp（ACP 协议 JSON）
  detector（ACP）：

  - JSON 事件 Done / done:true → success
  - JSON 事件 Error → failure

  ### 4) codex

  JSON 模式（vibe‑kanban 方式）：
  运行 codex app-server，用 JSON‑RPC 通信
  detector：

  - JSON‑RPC response / notification 中的完成事件 → success
  - JSON‑RPC error → failure
    （实际完成信号用“协议回调”更稳，等价 vibe‑kanban 的 exit_signal）

  ### 5) opencode

  JSON 模式（vibe‑kanban 方式）：
  启动 opencode server（SDK event stream JSON）
  detector：

  - SessionStatus: completed / Done → success
  - SessionError → failure

  ———

  ## 改造落点（文件级别）

  Main

  - 新增：src/main/services/cli/CliSessionService.ts
  - 新增：src/main/services/cli/adapters/{claude,cursor,gemini,codex,opencode}.ts
  - 修改：src/main/index.ts
      - 新增 cliSession:* IPC
      - logStream:* 改为读取 CliSessionService 的 MsgStore
      - claudeCode:* IPC 转发到 cliSession
  - 可移除/降级：CLIProcessService.ts（统一到 CliSessionService）

  Renderer

  - 新增：src/renderer/src/components/cli/CLISession.tsx
  - 修改：src/renderer/src/pages/TaskDetail.tsx
      - 用 task.cli_tool_id 渲染 CLISession
      - onStatusChange 逻辑不变，只是适用所有 CLI
  - 修改：src/renderer/src/hooks/useLogStream.ts
      - logStream 接口对齐新 service（功能不变）

  ———

  ## 风险/注意点

  - codex/opencode/gemini 在 vibework 里 当前不存在执行协议实现，需要 adapter 里引入最小 JSON‑RPC/ACP/SDK 协议逻辑（这是适配“所有 CLI”的关键工作量）。
  - 如果某 CLI 参数不支持 JSON 模式，detector 会失效 → 自动 fallback 到“进程退出”，但你要求“都支持”，因此应当强制 JSON 模式。