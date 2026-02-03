## Why

Dashboard 目前是空的，无法帮助用户快速了解任务与工作流的运行状态。补齐核心信息概览与最近动态，可以降低上下文切换成本，让用户更快发现问题并采取行动。

## What Changes

- 增加 Dashboard 概览区：展示关键指标卡片（进行中任务数、待审核任务数、最近失败数等）。
- 增加 Dashboard 最近活动区：展示最近任务与工作流的状态、更新时间、负责人/来源。
- 增加快捷入口与空状态引导（无任务时提示创建任务/工作流）。

## Capabilities

### New Capabilities
- `dashboard-overview`: 提供 Dashboard 的关键指标与概览布局，支持基础统计与空状态提示。
- `dashboard-activity`: 提供最近任务/工作流活动列表与状态展示，支持按时间排序与简要状态聚合。

### Modified Capabilities

## Impact

- 前端：新增 Dashboard 页面模块与组件（概览卡片、活动列表、空状态）。
- 后端/数据层：新增或扩展查询以聚合任务、工作流、执行日志的统计信息。
- API：可能新增 Dashboard 相关的聚合接口或扩展现有任务/工作流查询接口。
