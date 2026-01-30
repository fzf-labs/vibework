## Why

当前任务执行流程与UI的联动存在根本性问题：任务状态变更与工作流执行之间缺乏自动化衔接，审核流程没有对应的UI呈现，导致用户无法直观地控制和监督任务的完整生命周期。

## What Changes

- **BREAKING**: 任务状态变更时自动触发工作流执行（todo → in_progress 时立即启动第一个工作节点）
- 新增工作节点审核UI界面，支持人工审核、批准和拒绝操作
- 重构任务详情页，整合工作流进度可视化和节点状态展示
- 建立任务状态与工作流状态的双向同步机制
- 强制所有任务必须设置工作流模板才能执行

## Capabilities

### New Capabilities

- `task-workflow-automation`: 任务状态变更时自动触发工作流执行的自动化机制
- `work-node-review-ui`: 工作节点审核界面，包含审核面板、批准/拒绝操作、审核历史展示
- `workflow-progress-visualization`: 工作流进度可视化组件，展示节点状态、当前执行位置、整体进度

### Modified Capabilities

- `workflow-management`: 增加任务状态与工作流状态的自动同步逻辑
- `work-node-execution`: 增加执行完成后根据 requires_approval 自动进入审核或完成状态的逻辑

## Impact

**受影响的代码**:
- `src/renderer/src/pages/TaskDetail.tsx` - 任务详情页重构
- `src/renderer/src/hooks/useAgent.ts` - Agent执行钩子，增加工作流自动触发
- `src/main/services/DatabaseService.ts` - 数据库服务，增加状态同步逻辑

**受影响的API**:
- 任务状态更新API需要触发工作流状态变更
- 新增工作节点审核相关API（approve/reject）

**新增组件**:
- WorkNodeReviewPanel - 审核面板组件
- WorkflowProgressBar - 工作流进度条组件
- WorkNodeStatusBadge - 节点状态徽章组件

**数据模型影响**:
- 无需修改现有数据模型，复用已有的 Workflow、WorkNode、AgentExecution 表结构
