## Why

任务详情页的 Git diff 页面当前功能不全且视觉粗糙，无法有效支持变更审阅与定位问题，影响任务执行与回溯效率。需要统一、可复用的高质量 diff 组件，提升可读性与交互能力。

## What Changes

- 重构任务详情页的 Git diff 展示，提供完整的文件级与行级差异查看能力。
- 引入独立的 Git diff 组件，统一渲染逻辑与样式，支持在其他页面复用。
- 以现有 demo 实现为参考，补齐语法高亮、文件头信息与视图布局细节。

## Capabilities

### New Capabilities
- `task-detail-git-diff-view`: 在任务详情页中以高质量、可复用组件展示 Git diff（文件列表、diff 视图、语法高亮、基础交互）。

### Modified Capabilities
- <!-- None -->

## Impact

- 前端：任务详情页 Git diff UI/交互、样式与组件结构
- 依赖：新增/调整 `@git-diff-view/file`、`@git-diff-view/react`、`@git-diff-view/shiki` 的集成
- 组件复用：抽离独立组件供其他 Git 相关视图使用
