# Agent Tool Configs 设计方案

目的：为不同 Agent CLI 提供可配置的“配置项（Profile）”，在设置页维护，在创建任务时选择并应用。

## 背景
当前任务仅保存 `cli_tool_id`，缺少“同一工具多套配置”的能力。参考 vibe-kanban 的 executor profile 机制，新增 `agent_tool_configs` 实体，以支持：
- 每个 CLI 工具维护多套配置（DEFAULT/FAST/SAFE 等）
- 任务选择配置项，并在执行时应用
- 配置可复制/编辑/设为默认

## 范围
- 新增 `agent_tool_configs` 表（替代此前提案中的 `cli_tool_configs`）
- 任务增加关联字段
- 设置页 UI 维护配置项
- 任务创建/编辑时选择配置项
- CLI Session 启动时加载并映射配置

## 数据库设计

### 表：agent_tool_configs
```sql
CREATE TABLE IF NOT EXISTS agent_tool_configs (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,          -- claude-code / codex / gemini-cli / opencode / cursor-agent
  name TEXT NOT NULL,             -- DEFAULT / FAST / SAFE / 自定义名称
  description TEXT,
  config_json TEXT NOT NULL,      -- JSON，按 tool schema 解释
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_config
  ON agent_tool_configs(tool_id, name) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_default
  ON agent_tool_configs(tool_id) WHERE is_default = 1 AND deleted_at IS NULL;
```

### 表：tasks 新增字段
```sql
ALTER TABLE tasks ADD COLUMN agent_tool_config_id TEXT;
ALTER TABLE tasks ADD COLUMN agent_tool_config_snapshot TEXT;
```
字段说明：
- `agent_tool_config_id`：指向 `agent_tool_configs.id`
- `agent_tool_config_snapshot`：可选快照（JSON），用于保证可复现

> 外键可选：`FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL`

## 配置项 Schema（config_json）
统一结构 + 工具专用字段：

### 通用字段
- `executablePath` (string) 可执行文件路径
- `env` (object<string,string>) 环境变量
- `additionalArgs` (string[]) 额外命令参数

### Claude Code
- `model` (string)
- `dangerouslySkipPermissions` (boolean) 可映射成 `--dangerously-skip-permissions`

### Codex
- `model` (string)
- `threadId` / `resumeThreadId` (string) 用于续聊

### Gemini CLI
- `model` (string)
- `useExperimentalAcp` (boolean) 映射 `--experimental-acp`

### Cursor Agent / Opencode
- `apiKey` (string) Cursor 可用，映射 `--api-key`
- `model` (string)
- `additionalArgs` (string[])

### 工具差异化与必填项
不同工具需要不同参数/环境变量，配置项必须允许“按工具定制”。示例：
- Cursor Agent 需要 `env.CURSOR_API_KEY`

建议在 UI 中基于 `tool_id` 做必填校验与提示（如：缺少 `CURSOR_API_KEY` 时阻止保存或提示风险）。

> Schema 以兼容为主，未识别字段保留在 JSON 中，便于未来扩展。

## 基于 `--help` 的参数支持矩阵（2026-02-05）
说明：以下参数来自本机 `--help` 输出。为降低复杂度，分为“结构化字段支持 + 透传参数”。结构化字段在 UI 中显式呈现，其余可通过 `additionalArgs` 透传。

### Claude Code (`claude`)
结构化字段 → CLI 映射：
- `model` → `--model`
- `agent` → `--agent`
- `agentsJson` → `--agents <json>`
- `addDir[]` → `--add-dir <dirs...>`
- `allowedTools[]` → `--allowed-tools` / `--allowedTools`
- `disallowedTools[]` → `--disallowed-tools` / `--disallowedTools`
- `appendSystemPrompt` → `--append-system-prompt`
- `systemPrompt` → `--system-prompt`
- `permissionMode` → `--permission-mode`（acceptEdits/bypassPermissions/default/delegate/dontAsk/plan）
- `mcpConfig[]` → `--mcp-config`
- `strictMcpConfig` → `--strict-mcp-config`
- `settings` → `--settings`
- `settingSources` → `--setting-sources`
- `sessionId` → `--session-id`
- `resume` → `--resume`
- `continue` → `--continue`
- `outputFormat` → `--output-format`
- `inputFormat` → `--input-format`
- `includePartialMessages` → `--include-partial-messages`
- `replayUserMessages` → `--replay-user-messages`
- `noSessionPersistence` → `--no-session-persistence`
- `debug` → `--debug`
- `debugFile` → `--debug-file`
- `verbose` → `--verbose`
- `betas[]` → `--betas`
- `fallbackModel` → `--fallback-model`
- `maxBudgetUsd` → `--max-budget-usd`
- `jsonSchema` → `--json-schema`
- `tools` → `--tools`
- `fileResources[]` → `--file`
- `allowDangerouslySkipPermissions` → `--allow-dangerously-skip-permissions`
- `dangerouslySkipPermissions` → `--dangerously-skip-permissions`

透传：
- 其它 CLI 参数通过 `additionalArgs` 传入（例如 `--chrome` / `--no-chrome` / `--ide` / `--plugin-dir`）。

### Codex (`codex`)
结构化字段 → CLI 映射：
- `model` → `--model`
- `profile` → `--profile`
- `sandbox` → `--sandbox`（read-only / workspace-write / danger-full-access）
- `askForApproval` → `--ask-for-approval`（untrusted/on-failure/on-request/never）
- `fullAuto` → `--full-auto`
- `dangerouslyBypassApprovalsAndSandbox` → `--dangerously-bypass-approvals-and-sandbox`
- `oss` → `--oss`
- `localProvider` → `--local-provider`
- `search` → `--search`
- `addDir[]` → `--add-dir`
- `cd` → `--cd`
- `noAltScreen` → `--no-alt-screen`
- `configOverrides[]` → `-c key=value`
- `enableFeatures[]` → `--enable`
- `disableFeatures[]` → `--disable`
- `imagePaths[]` → `--image`（若要支持图像附件）

透传：
- 其它参数通过 `additionalArgs` 传入。

### Cursor Agent (`cursor-agent`)
结构化字段 → CLI 映射：
- `apiKey` → `--api-key`（或 `env.CURSOR_API_KEY`）
- `headers[]` → `--header "Name: Value"`
- `model` → `--model`
- `mode` → `--mode`（plan/ask）
- `plan` → `--plan`
- `resume` → `--resume`
- `continue` → `--continue`
- `force` → `--force`
- `sandbox` → `--sandbox`（enabled/disabled）
- `approveMcps` → `--approve-mcps`（仅 print/headless）
- `workspace` → `--workspace`
- `outputFormat` → `--output-format`（text/json/stream-json）
- `streamPartialOutput` → `--stream-partial-output`
- `cloud` → `--cloud`
- `print` → `--print`

必填校验：
- 若未提供 `apiKey` 且环境变量缺失，则提示缺少 `CURSOR_API_KEY`。

### Gemini CLI (`gemini`)
结构化字段 → CLI 映射：
- `model` → `--model`
- `promptMode` → `--prompt` / `--prompt-interactive`
- `sandbox` → `--sandbox`
- `yolo` → `--yolo`
- `approvalMode` → `--approval-mode`
- `experimentalAcp` → `--experimental-acp`
- `allowedMcpServerNames[]` → `--allowed-mcp-server-names`
- `allowedTools[]` → `--allowed-tools`
- `extensions[]` → `--extensions`
- `resume` → `--resume`
- `includeDirectories[]` → `--include-directories`
- `outputFormat` → `--output-format`
- `rawOutput` → `--raw-output`
- `acceptRawOutputRisk` → `--accept-raw-output-risk`
- `debug` → `--debug`

### OpenCode (`opencode`)
结构化字段 → CLI 映射：
- `model` → `--model`
- `continue` → `--continue`
- `session` → `--session`
- `prompt` → `--prompt`
- `agent` → `--agent`
- `printLogs` → `--print-logs`
- `logLevel` → `--log-level`
- `port` → `--port`
- `hostname` → `--hostname`
- `mdns` → `--mdns`
- `mdnsDomain` → `--mdns-domain`
- `cors[]` → `--cors`

透传：
- 其它参数通过 `additionalArgs` 传入。

## 运行时应用逻辑

### 优先级
1) 任务快照（`agent_tool_config_snapshot`）  
2) 关联配置项（`agent_tool_config_id` -> `agent_tool_configs.config_json`）  
3) 现有本机 CLI 默认配置（`CLIToolConfigService`）

### 映射到启动参数
- `executablePath` -> `CliStartOptions.executablePath`
- `env` -> 合并到 `CliStartOptions.env`
- `model` -> `CliStartOptions.model`
- `additionalArgs` -> 由各 Adapter 追加到 `args`

## UI 设计

### 设置 -> Agent CLI
新增「配置项管理」区域（在现有检测区块下方）：
- 工具切换（Tab 或 Segmented）
- 配置项列表（名称/描述/是否默认/更新时间）
- 操作：编辑 / 复制 / 删除 / 设为默认
- 新建配置项按钮

编辑弹窗：
- 基本信息：名称、描述、设为默认
- 通用配置：可执行路径、环境变量、额外参数
- 工具专有字段（动态表单）
- 必填校验与提示（按 tool_id）
- 高级：JSON 编辑器（可选）
- 支持从本机 CLI 配置导入（可选）

### 创建任务
新增「CLI 配置项」下拉框（依赖 CLI 工具选择）：
- 仅展示该工具的配置项
- 默认选中 `is_default` 的配置项
- 若无配置项：提示“去设置创建”

### 任务详情
显示 Profile 名称（如：Codex / FAST）  
任务 `todo` 时允许编辑配置项

## 迁移策略
启动时自动补齐每个工具一个 `DEFAULT` 配置项：
- 优先读取 `CLIToolConfigService.getConfig(toolId)`
- 若读取失败，使用内置默认值

现有任务：
- `agent_tool_config_id` 设为该工具 DEFAULT
- `agent_tool_config_snapshot` 为空（可选）

## IPC / Service 调整
新增 CRUD：
- `agentToolConfigs.list(toolId?)`
- `agentToolConfigs.create(input)`
- `agentToolConfigs.update(id, updates)`
- `agentToolConfigs.delete(id)`
- `agentToolConfigs.setDefault(id)`

CLI Session 启动支持传入配置项 ID 或完整配置：
- `cliSession.startSession(sessionId, toolId, workdir, { prompt, model, projectId, configId? })`
- Service 内解析配置并传给 Adapter

## 安全与存储
- 配置项存本地 DB（与现有 settings 一致）
- 若包含敏感信息，可考虑后续接入系统钥匙串

## 后续可扩展项
- 按项目范围的配置项（project-scoped）
- 配置项分组/标签
- 快照策略可配置（启用/禁用）
