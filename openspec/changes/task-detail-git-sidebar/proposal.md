## Why

任务详情页右侧的 Git 面板目前是占位实现，无法查看变更、分支与历史，导致在任务执行过程中缺少基本的版本控制反馈与操作入口。需要补齐基础能力，让任务内的 Git 状态可见且可操作。

## What Changes

- 在任务详情页右侧新增可用的 Git 面板：展示工作区变更与分支对比（基准分支 vs 当前分支）。
- 提供变更文件刷新与基础的暂存/取消暂存入口。
- 为无 Git 或无工作目录的场景提供清晰的空状态与错误提示。

## Capabilities

### New Capabilities
- `task-detail-git-panel`: 在任务详情页右侧展示并操作任务工作目录的 Git 状态（变更、历史、分支）。

### Modified Capabilities
- <!-- None -->

## Impact

- 前端：任务详情页右侧面板与 Git 子面板 UI/交互
- IPC/服务：调用现有 Git IPC API（status/branches/log/diff/stage）
- 可能影响：任务工作目录为空或非 Git 仓库的处理逻辑
