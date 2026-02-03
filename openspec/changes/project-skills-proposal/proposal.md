## Why

当前「项目级 Skills」页面是空的，而 Skills 只在全局设置中可见与管理。对于团队协作或多项目并行的场景，技能往往与仓库上下文强相关（约定、工具链、脚本、提示模板等），如果只能用全局 Skills，会导致复用成本高、配置混乱且难以共享。补齐项目级 Skills 能让技能随项目一起管理、版本化，并在任务执行时自动生效。

## What Changes

- 在 `/skills` 页面实现项目级 Skills 管理：展示当前项目信息、技能列表、来源目录与空状态引导。
- 支持从项目目录加载 Skills（例如 `.<cli>/skills`、`.vibework/skills`），并提供刷新、打开目录、删除（项目内）等操作。
- 增加「从 GitHub 导入」到项目目录的能力，并提供从全局 Skills 复制/引用到项目的入口。
- 新增项目级 Skills 配置（启用开关、目录覆盖/追加、来源优先级），随项目保存；任务执行时将项目级 Skills 注入 `skillsConfig`，优先级高于全局。

## Capabilities

### New Capabilities
- `project-skills-management`: 在项目范围内发现、展示与管理 Skills，并在任务执行时优先加载项目 Skills。

### Modified Capabilities

## Impact

- 前端：Skills 页面、技能卡片/空状态组件、项目上下文提示；复用全局 Skills 管理交互。
- 数据层：为项目保存 Skills 配置（DB 字段或项目配置文件）。
- IPC/文件操作：读取项目技能目录、删除/导入 Skills、复制全局 Skills。
- Agent 配置：扩展 `skillsConfig` 以包含项目级路径与优先级。
