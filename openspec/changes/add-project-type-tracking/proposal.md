# Change: Add project type tracking and path validation

## Why
当前项目没有区分普通项目与 Git 项目，且项目路径被移动或删除时缺少提醒，导致项目管理信息不准确。

## What Changes
- 在数据库中新增 `project_type` 字段，用于区分 `normal` 与 `git` 项目。
- 新建项目时根据项目根目录是否包含 `.git` 判定类型并持久化。
- 用户点击项目时检测路径是否存在/已移动，并提示用户；同时按需更新 `project_type`。
- 更新项目管理规格以覆盖类型分类与路径校验行为。

## Impact
- Affected specs: project-management
- Affected code: DatabaseService/ProjectService、IPC 项目接口、前端项目创建与选择逻辑
