## Context

VibeWork 是一个跨平台桌面应用,为命令行 AI 工具(如 Claude Code、Gemini CLI)提供统一的图形界面。当前项目已有:

- Electron + React + TypeScript 基础框架
- 主进程服务层骨架(GitService, ClaudeCodeService, PipelineService 等)
- 渲染进程 UI 组件框架
- IPC 通信基础设施

### 约束条件
- 必须支持 Windows、macOS 平台
- 需要与现有 CLI 工具无缝集成,不修改其行为
- 必须保证 Git 操作的安全性
- 需要支持大型代码仓库(>10000 文件)

## Goals / Non-Goals

### Goals
- 提供统一的多 AI Agent 管理界面
- 实现基于 Git worktree 的任务隔离机制
- 提供可视化的 Git 操作和代码预览
- 支持全局和项目级的配置管理

### Non-Goals (MVP 阶段)
- 不实现完整的任务流水线(阶段2)
- 不支持多 CLI 工具(仅 Claude Code)
- 不实现插件系统
- 不提供团队协作功能

## Decisions

### 1. 架构: 保持现有 Electron 多进程架构

**决策**: 继续使用主进程 + 渲染进程 + IPC 通信模式

**理由**:
- 现有代码已按此模式组织
- 主进程负责系统级操作(Git、进程管理)
- 渲染进程负责 UI,保持响应性
- IPC 通信保证安全性

### 2. 状态管理: 使用 React hooks + Context

**决策**: 使用现有的 hooks 模式管理状态

**理由**:
- 项目已有 useAgent、useProviders 等 hooks
- 避免引入额外状态管理库
- 保持代码简洁

### 3. Git Worktree: 按设计文档实现

**决策**: 每个任务自动创建独立的 git worktree

**实现细节**:
```
任务创建: git worktree add .worktrees/task-{id} -b task-{id}
任务完成: git worktree remove .worktrees/task-{id}
```

### 4. CLI 集成: 进程包装模式

**决策**: 通过子进程启动 CLI 工具,捕获 stdout/stderr

**理由**:
- ClaudeCodeService 已实现基础框架
- 保持 CLI 工具独立性
- 支持输出流实时展示

## Risks / Trade-offs

### 风险1: CLI 工具输出格式变化
- **缓解**: 使用宽松解析,提供原始输出降级模式

### 风险2: Git 操作冲突
- **缓解**: UI 层提示活跃 worktree,提供冲突检测

### 风险3: 大型仓库性能
- **缓解**: 增量加载,虚拟滚动,缓存 Git 状态

## Open Questions

1. MCP 服务器配置是否完全兼容 Claude Code 格式?
2. 是否需要提供预设的任务模板?
