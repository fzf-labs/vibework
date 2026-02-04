## Context

当前 `/mcp` 页面仅有标题与说明，项目级 MCP 功能未实现；MCP 管理集中在全局设置页（读取 `~/.vibework/mcp/mcp.json` 与各 CLI 配置、支持导入/编辑/查看）。项目上下文已通过 `projects` 表与 `useProjects` 提供，但页面未展示项目 MCP 详情。

需求更新后，项目 MCP 页面仅需要检测/展示，而不是完整编辑能力；同时要求按 Agent CLI 维度分别展示全局 MCP 与项目 MCP，并能看到具体 MCP 服务器名称与类型。

## Goals / Non-Goals

**Goals:**
- 按 Agent CLI 展示项目 MCP 状态：全局配置 + 项目配置，并显示服务器明细。
- 项目 MCP 配置文件按 CLI 维度解析，默认路径为 `<project>/.vibework/mcp/<cliId>.json`。
- 任务执行时注入对应 CLI 的项目 MCP 配置，优先级高于全局配置。
- 在全局设置已安装增加同步到 CLI 能力，支持多选。
- 支持点击查看 MCP 服务器详情。

**Non-Goals:**
- 不在 `/mcp` 页面提供新增/编辑/删除/导入等配置能力。
- 不新增 MCP 服务器市场或验证逻辑。
- 不做跨项目自动同步。

## Decisions

- **项目 MCP 配置文件路径（按 CLI）**
  - 方案：`<project>/.vibework/mcp/<cliId>.json`。
  - 理由：不同 CLI 的配置格式与来源不同，按 CLI 拆分避免冲突。

- **项目 MCP 页面形态**
  - 方案：仅做检测与展示，类似 Skills 页面。
  - 展示内容：每个 CLI 的全局 MCP 状态 + 项目 MCP 状态 + 服务器名称与传输类型。

- **全局设置同步到 CLI**
  - 方案：在已安装页新增多选同步，写入 `mcpServers` 到所选 CLI JSON 配置。
  - 限制：仅对可写 JSON 配置生效（TOML 仅展示）。

- **Agent 注入方式**
  - 方案：扩展 `mcpConfig`，增加 `projectConfigPath` 与 `mergeStrategy`（project_over_global）。

## Risks / Trade-offs

- [Risk] CLI 配置格式不同导致同步范围受限 → Mitigation: 仅对 JSON 开放同步，TOML 只读展示。
- [Risk] 项目 MCP 与全局 MCP 同名覆盖不透明 → Mitigation: 通过分栏展示全局/项目，并标注服务器列表。
- [Risk] 项目目录无写权限 → Mitigation: 同步时保证目录创建，失败时保持全局配置不变。

## Migration Plan

- 项目 MCP 配置采用新的 per-CLI 路径，无需迁移旧文件；缺失时默认仅显示全局配置。
- 回滚：保留全局 MCP 行为不变，项目页仅作为检测入口。

## Open Questions

- 是否需要为项目 MCP 提供仅项目/仅全局/合并开关并持久化到项目设置？
- 项目 MCP 配置是否建议加入 `.gitignore`，还是鼓励提交以便团队共享？
