## Why

当前系统中"任务"、"工作流"、"工作流阶段"、"Agent CLI 执行"等概念混乱，状态定义不清晰。Task 的状态混合了执行状态和流程状态，缺少 Workflow（工作流）和 WorkNode（工作节点）的中间抽象层，导致代码难以维护和扩展。需要按照新的层级设计（Project → Task → Workflow → WorkNode → Agent CLI）重构整个任务系统。

## What Changes

- **BREAKING**: 移除现有的 `PipelineTemplate` 和 `PipelineTemplateStage` 概念，替换为 `WorkflowTemplate` 和 `WorkNodeTemplate`
- **BREAKING**: 重构 `Task` 类型，分离执行状态和流程状态
- 新增 `Workflow` 实体，作为任务的执行方式定义
- 新增 `WorkNode` 实体，作为工作流中的单个执行单元
- 新增 `AgentExecution` 实体，跟踪 Agent CLI 的执行状态
- 重新设计状态流转：
  - Task 状态: `todo` → `in_progress` → `in_review` → `done`
  - WorkNode 状态: `todo` → `in_progress` → `in_review` → `done`
  - AgentExecution 状态: `idle` → `running` → `completed`
- 更新数据库 schema 以支持新的层级结构
- 更新 UI 组件以反映新的概念模型

## Capabilities

### New Capabilities

- `workflow-management`: 工作流模板的创建、编辑、删除和实例化管理
- `work-node-execution`: 工作节点的执行控制和状态跟踪
- `agent-execution-tracking`: Agent CLI 执行状态的独立跟踪和多轮对话支持

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **数据库**: 需要迁移现有的 `pipeline_templates` 和 `pipeline_template_stages` 表
- **API/数据层**: `src/renderer/src/data/` 下的类型定义和数据操作需要重构
- **UI 组件**:
  - `PipelineTemplatesSettings.tsx` 需要重命名和重构
  - `PipelineTemplateDialog.tsx` 需要重命名和重构
  - 任务详情页需要展示新的层级结构
- **Provider**: `project-provider.tsx` 可能需要调整
- **国际化**: `task.ts` 中的翻译 key 需要更新
