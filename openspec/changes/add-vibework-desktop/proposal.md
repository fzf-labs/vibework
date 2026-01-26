# Change: 添加 VibeWork 多AI Agent桌面应用

## Why

当前开发者需要在命令行中使用多个AI工具(Claude Code、Gemini CLI、Codex等),缺乏统一的图形界面和项目管理能力。开发者需要:
- 在多个终端窗口间切换来管理不同的AI会话
- 手动管理git worktree和任务流程
- 缺少可视化的代码预览和diff工具
- 无法有效地并行处理多个开发任务

VibeWork旨在提供一个跨平台的桌面应用,作为"与CLI AI Agent协作"的统一工作台,提升开发效率。

## What Changes

### 核心功能
- **多AI Agent集成**: 统一管理Claude Code、Gemini CLI、Codex等CLI工具
- **项目管理**: 基于Git仓库的项目管理,支持远程克隆和本地创建
- **任务工作流**:
  - 每个任务自动创建独立的git worktree
  - 支持自定义任务流水线(pipeline),每个环节需人工确认
  - 任务看板可视化管理
  - 环节完成和任务完成的声音/通知提醒
- **开发增强**:
  - 实时代码预览和编辑
  - 多会话并行处理
  - Git可视化操作(diff、merge、PR、rebase)
  - 可配置的预览脚本(前端/后端项目)
- **配置管理**:
  - 全局级别的MCP、Skill、任务流水线配置
  - 项目级别的MCP、Skill、任务流水线配置
  - 项目打开方式配置(VSCode、Cursor等)

### 技术栈
- Electron + React + TypeScript
- 跨平台支持(Windows、macOS、Linux)

## Impact

### 新增能力(Specs)
- `app-shell`: 应用主框架和窗口管理
- `project-repos`: Git仓库项目管理
- `task-orchestration`: 任务编排和流水线管理
- `cli-tool-integration`: CLI AI工具集成层
- `git-operations`: Git可视化操作
- `preview-runner`: 预览脚本执行器
- `notifications`: 通知和提醒系统
- `config-scopes`: 全局和项目级配置管理

### 受影响的代码
- 新建完整的Electron应用架构
- 主进程、渲染进程、预加载脚本
- IPC通信层
- 数据持久化层
- UI组件库

### 依赖关系
- 需要系统安装git
- 需要用户配置CLI AI工具路径
- 可选依赖外部编辑器(VSCode、Cursor等)
