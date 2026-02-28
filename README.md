# VibeWork

VibeWork 是一个本地优先的桌面 AI 工作台，基于 Electron + React + TypeScript 构建。它聚合了项目管理、任务编排、Agent CLI 调用、自动化调度与执行日志，目标是把「AI 协作开发」放进一个可追踪、可复用、可自动化的工作流里。

## 核心能力

- 多项目管理：维护本地项目路径并检测状态。
- 任务系统：支持 `conversation` 与 `workflow` 两种任务模式。
- 流水线模板：支持多节点编排、审批节点、节点级 CLI 配置。
- Agent CLI 集成：检测并调用 Claude Code / Codex / Gemini CLI / OpenCode / Cursor Agent。
- 自动化调度：支持 `interval`、`daily`、`weekly` 触发与运行记录。
- Git 协作能力：分支、Worktree、Diff、提交与冲突处理。
- 内置终端与日志：任务输出流、会话历史、终端交互。
- Skills 与 MCP：可配置 Skills 目录与 MCP 配置。
- 本地持久化：SQLite + 本地文件存储（默认 `~/.vibework`）。

## 技术栈

- Electron 39
- React 19 + React Router + Radix UI + Tailwind CSS
- electron-vite + Vite + TypeScript
- better-sqlite3 + node-pty
- Vitest（Node 环境）

## 环境要求

- Node.js 20+
- pnpm 9+
- Git（涉及项目管理和 worktree 能力时必需）
- macOS / Windows / Linux

## 3 分钟上手

```bash
pnpm install
pnpm dev
```

- 开发模式会同时启动 Electron 主进程和渲染进程。
- 渲染进程默认端口：`3333`。

## 建议使用流程

1. 在 `Projects` 页面添加本地项目目录。
2. 在 `Settings -> Agent CLI` 中检测并设置默认 CLI。
3. 在 `Home` 或 `Tasks` 创建任务（conversation/workflow）。
4. 在任务详情页查看执行状态、日志与产物。
5. 在 `Pipeline Templates` 维护可复用流程模板。
6. 在 `Automations` 配置定时任务并查看运行记录。

## 支持的 CLI 工具

| Tool ID | 默认命令 |
| --- | --- |
| `claude-code` | `claude` |
| `codex` | `codex` |
| `gemini-cli` | `gemini` |
| `opencode` | `opencode` |
| `cursor-agent` | `cursor-agent` |

## 常用脚本

| 脚本 | 说明 |
| --- | --- |
| `pnpm dev` | 开发模式 |
| `pnpm start` | 预览构建产物 |
| `pnpm build` | 类型检查 + 构建 |
| `pnpm build:unpack` | 构建并输出未打包目录 |
| `pnpm build:win` | 构建 Windows 安装包 |
| `pnpm build:mac` | 构建 macOS 包（含签名命令） |
| `pnpm build:linux` | 构建 Linux 包（AppImage/snap/deb） |
| `pnpm test` | 运行测试 |
| `pnpm lint` / `pnpm lint:fix` | 代码检查 / 自动修复 |
| `pnpm typecheck` | Node + Web 类型检查 |
| `pnpm format` | Prettier 格式化 |

## 数据目录

默认数据根目录：

```bash
~/.vibework
```

主要文件与目录：

- `config/settings.json`：应用设置（主题、通知、编辑器等）。
- `data/vibework.db`：SQLite 数据库（项目、任务、节点、模板、自动化）。
- `data/sessions/`：任务会话与消息日志。
- `logs/cli-output/`：CLI 输出日志。
- `logs/pipeline-output/`：流水线阶段日志。
- `worktrees/`：Git worktree 默认目录。
- `cache/`：运行缓存。

## 环境变量（可选）

### 命令与 CLI 检测

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VIBEWORK_GIT_PATH` | - | 指定 Git 可执行文件路径 |
| `VIBEWORK_COMMAND_ALLOWLIST` | - | 追加命令白名单（逗号分隔） |
| `VIBEWORK_COMMAND_TIMEOUT_MS` | `30000` | 命令执行超时（毫秒） |
| `VIBEWORK_CLI_DETECT_FAST_TIMEOUT_MS` | `800` | 快速检测超时（毫秒） |
| `VIBEWORK_CLI_DETECT_FULL_TIMEOUT_MS` | `2000` | 完整检测超时（毫秒） |
| `VIBEWORK_CLI_DETECT_FAST_CACHE_MS` | `300000` | 快速检测缓存时长（毫秒） |
| `VIBEWORK_CLI_DETECT_FULL_CACHE_MS` | `86400000` | 完整检测缓存时长（毫秒） |
| `VIBEWORK_CLAUDE_MODEL` | `sonnet` | Claude 默认模型 |

### 日志与输出

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VIBEWORK_LOG_FLUSH_INTERVAL_MS` | `50` | 日志批量刷盘间隔 |
| `VIBEWORK_LOG_BATCH_MAX_BYTES` | `262144` | 单批日志最大字节数 |
| `VIBEWORK_LOG_MAX_BYTES` | `10485760` | 单日志文件最大字节数 |
| `VIBEWORK_LOG_MAX_FILES` | `5` | 日志轮转保留文件数 |
| `VIBEWORK_OUTPUT_MAX_BYTES` | `524288` | 输出缓冲最大字节数 |
| `VIBEWORK_OUTPUT_MAX_ENTRIES` | `2000` | 输出缓冲最大条目数 |
| `VIBEWORK_OUTPUT_SPOOL_ENABLED` | `false` | 是否启用输出落盘 |
| `VIBEWORK_OUTPUT_SPOOL_FLUSH_MS` | `250` | 输出落盘刷盘间隔 |
| `VIBEWORK_OUTPUT_SPOOL_BATCH_BYTES` | `131072` | 输出落盘单批最大字节数 |
| `VIBEWORK_OUTPUT_SPOOL_MAX_BYTES` | `5242880` | 输出落盘单文件最大字节数 |
| `VIBEWORK_OUTPUT_SPOOL_MAX_FILES` | `3` | 输出落盘轮转文件数 |

### IPC 安全边界

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VIBEWORK_ALLOWED_URL_DOMAINS` | - | 允许访问的 URL 域名白名单（逗号分隔） |
| `VIBEWORK_ALLOWED_FS_ROOTS` | - | 额外允许的文件系统根路径（逗号分隔） |

## 安全设计

- 命令执行白名单：仅允许白名单命令通过主进程安全执行。
- URL 访问控制：仅允许 `http/https`，并支持域名白名单。
- 文件访问白名单：基于根目录白名单控制 IPC 文件系统访问。
- Electron 安全配置：`contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。

## 构建与发布

- 打包配置文件：`electron-builder.yml`。
- 自动更新地址当前为占位值：`https://example.com/auto-updates`，发布前请替换。
- `pnpm build:mac` 包含签名命令，仅适用于已配置签名环境的 macOS。

## 项目结构

```text
.
├── src/
│   ├── main/        # Electron 主进程：服务、IPC、数据库、自动化、Git、终端
│   ├── preload/     # 预加载桥接 API
│   └── renderer/    # React 前端页面与组件
├── tests/           # Vitest 测试
├── resources/       # 图标与声音资源
├── build/           # 打包资源（图标、entitlements）
└── openspec/        # OpenSpec 变更与规范配置
```

## 开发建议

- 推荐 IDE：VS Code + ESLint + Prettier。
- 提交前建议运行：

```bash
pnpm lint && pnpm typecheck && pnpm test
```
