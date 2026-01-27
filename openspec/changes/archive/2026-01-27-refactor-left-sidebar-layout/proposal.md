# Change: 重构左边栏布局 - 项目功能导航

## Why

当前左边栏主要展示任务列表，但随着功能扩展，需要提供更完整的项目功能入口。用户需要快速访问看板、Skill、MCP 等核心功能，同时支持在底部切换或创建项目。

## What Changes

### 布局重构
- **顶部**: Logo + 侧边栏折叠按钮
- **功能导航区**: Dashboard、看板、Skill、MCP 四个主要功能入口
- **底部**: 项目切换器 + 设置按钮

### 功能说明
- **Dashboard**: 项目概览仪表盘，展示项目状态和统计
- **看板 (Board)**: 任务看板视图，可视化任务状态和进度
- **Skill**: 技能配置和管理
- **MCP**: MCP 服务器配置和状态

### 移除内容
- 移除左边栏中的任务列表直接展示
- 任务管理改为点击"看板"导航项后在主内容区以看板形式展示

## Impact

- Affected code:
  - `src/renderer/src/components/layout/left-sidebar.tsx` - 主要重构
  - `src/renderer/src/pages/Home.tsx` - 调整布局引用
  - `src/renderer/src/pages/TaskDetail.tsx` - 调整布局引用
  - `src/renderer/src/router.tsx` - 可能需要添加新路由
  - `src/renderer/src/data/` - 可能需要添加项目数据模型
