## Why

当前项目级 MCP 页面几乎为空，MCP 服务器的管理仅存在于全局设置中。对于多项目并行或团队协作场景，MCP 服务器通常与仓库上下文强相关（可用工具、权限范围、环境变量、服务 URL）。如果只能使用全局配置，容易产生冲突、污染其他项目，且难以随项目共享与版本化。

同时，不同 Agent CLI 有各自的全局配置位置与格式，项目 MCP 需要按 CLI 维度拆分与展示，否则无法准确判断每个 CLI 在项目中的有效 MCP 状态。

## What Changes

- `/mcp` 页面改为项目级 MCP 检测视图：按 Agent CLI 展示全局 MCP + 项目 MCP 的配置状态与服务器列表。
- 服务器条目支持点击查看详情（transport/command/url/headers 等）。
- 项目 MCP 配置按 CLI 维度存放：`<project>/.vibework/mcp/<cliId>.json`，并与全局配置合并（项目优先）。
- `/mcp` 页面移除项目目录、配置路径相关功能，只保留检测展示（类似 Skills 页面）。
- 全局设置 -> MCP 已安装新增同步到 CLI 能力，可多选目标 CLI 配置写入已安装的 MCP 服务器。
- 任务执行时根据 task 绑定的 CLI 选择对应项目 MCP 配置并传递 mergeStrategy。

## Capabilities

### New Capabilities
- `project-mcp-detection`: 在项目范围内按 CLI 展示 MCP 配置状态与服务器列表，并在任务执行时应用项目 MCP 配置。
- `mcp-sync-to-cli`: 将已安装 MCP 服务器同步到指定 CLI 配置文件。

### Modified Capabilities

## Impact

- 前端：`/mcp` 页面改为检测视图，按 CLI 展示全局与项目 MCP；新增服务器明细展示。
- 数据/配置：新增项目 MCP 配置路径解析（按 CLI），支持读取 JSON/TOML 全局配置并统计服务器。
- 设置：全局 MCP 已安装增加多选同步到 CLI 的操作。
- Agent 配置：扩展 `mcpConfig`，注入项目 MCP 配置路径与合并策略。
