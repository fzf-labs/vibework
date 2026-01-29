## Context
项目 CRUD 目前嵌在左侧栏的下拉菜单和对话框中，入口分散且不利于扩展。需求要求新增项目管理页面，并在无项目时强制引导创建。

## Goals / Non-Goals
- Goals:
  - 新增 `/projects` 页面集中处理项目 CRUD
  - 左侧项目切换器仅用于选择项目
  - 无项目时强制跳转并锁定在 `/projects`
- Non-Goals:
  - 不新增与项目无关的设置入口
  - 不引入额外的后端接口变更（复用现有 IPC）

## Decisions
- Decision: 使用独立路由 `/projects`，放在 `MainLayout` 下，侧栏仍可显示但主要入口在切换器旁按钮。
- Decision: 通过新增 `ProjectGuard`（或扩展 `SetupGuard`）在路由层实现无项目锁定，避免页面内各处重复判断。
- Decision: CRUD UI 从侧栏弹窗迁移到新页面，复用现有表单逻辑与 IPC。

## Risks / Trade-offs
- 路由层强制跳转可能影响深链接（无项目时），需明确行为并提示用户创建项目。

## Migration Plan
1) 添加 `/projects` 路由与页面
2) 迁移 CRUD UI
3) 更新侧栏切换器入口
4) 增加项目存在性 Guard

## Open Questions
- 是否需要在项目管理页提供“打开文件夹”等非 CRUD 操作（当前需求未要求）
