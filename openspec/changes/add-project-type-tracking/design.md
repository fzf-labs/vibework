## Context
需要在项目元数据中区分普通项目与 Git 项目，并在用户选择项目时检测路径是否存在，以提示路径移动或删除的情况。

## Goals / Non-Goals
- Goals:
  - 增加 `project_type` 字段并持久化。
  - 新建项目时基于项目根目录 `.git` 判定类型。
  - 点击项目时校验路径存在性并提示异常。
  - 在点击项目时按需更新 `project_type`。
- Non-Goals:
  - 后台定时轮询检测路径变化。
  - 自动修复或迁移已移动的项目路径。

## Decisions
- `project_type` 采用枚举字符串：`normal` | `git`。
- 类型判定只检查项目根目录是否包含 `.git`。
- 路径存在性与 `.git` 检测放在主进程（fs 访问集中），通过 IPC 暴露给渲染进程。
- 本地项目不自动 `git init`，仅依据 `.git` 判定类型。
- 路径异常仅通过提示弹窗/提示语告知用户，不在列表额外展示状态。

## Risks / Trade-offs
- 仅在点击时检测，无法实时感知路径变化。
- 若用户从非根目录选择项目，`.git` 可能不存在，类型会被判为 `normal`。

## Migration Plan
- 在 projects 表新增 `project_type` 列，默认值 `normal`。
- 现有项目类型在首次点击时校验并更新为 `git`（若根目录包含 `.git`）。

## Open Questions
无。
