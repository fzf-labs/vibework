# Tasks: optimize-board-layout

## Phase 1: 看板页面优化

### 1.1 简化看板页面布局
- [x] 移除 `TaskDetailSidebar` 组件及相关状态
- [x] 简化 Header 区域，保留新建任务和IDE打开按钮
- [x] 调整看板区域样式，使其铺满全屏
- **验证**: 看板页面正常显示，无侧边栏

### 1.2 任务卡片点击导航
- [x] 修改 `handleTaskClick` 使用 `useNavigate` 跳转
- [x] 传递必要的任务状态到详情页
- **验证**: 点击任务卡片能正确跳转到详情页

## Phase 2: 任务详情页重构

### 2.1 左侧CLI区域
- [x] 重构布局为左右分栏
- [x] 左侧固定宽度显示CLI执行情况
- [x] 底部保留聊天输入框
- **验证**: CLI输出正常显示，聊天功能正常

### 2.2 右侧功能面板框架
- [x] 创建 `RightPanel.tsx` 容器组件
- [x] 创建 `RightPanelTabs.tsx` 功能按钮栏
- [x] 实现Tab切换逻辑
- **验证**: 点击不同Tab能切换显示区域

### 2.3 文件预览面板
- [x] 迁移现有 `ArtifactPreview` 功能到新面板
- [x] 支持文件列表和预览切换
- **验证**: 文件预览功能正常工作

### 2.4 开发服务器面板
- [x] 迁移现有 `useVitePreview` 功能
- [x] 显示服务器状态和预览iframe
- **验证**: 开发服务器启动/停止正常

## Phase 3: Git功能面板

### 3.1 Git变更文件展示
- [x] 创建 `GitPanel.tsx` 主组件
- [x] 实现变更文件列表展示
- [x] 显示文件状态 (M/A/D)
- **验证**: 能正确显示Git变更文件

### 3.2 Git操作功能
- [x] 实现合并 (merge) 功能 (UI已完成，待后端API)
- [x] 实现创建PR功能 (UI已完成，待后端API)
- [x] 实现变基 (rebase) 功能 (UI已完成，待后端API)
- **验证**: Git操作能正确执行

### 3.3 后端Git API
- [ ] 添加 `git.getStatus` IPC接口
- [ ] 添加 `git.getChangedFiles` IPC接口
- [ ] 添加 `git.merge/rebase/createPR` IPC接口
- **验证**: API调用返回正确数据

## Dependencies

- Phase 2 依赖 Phase 1 完成
- Phase 3 可与 Phase 2 并行开发
