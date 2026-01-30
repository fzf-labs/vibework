## Context

当前系统使用 `PipelineTemplate` 和 `PipelineTemplateStage` 来定义任务的执行流程，但存在以下问题：

1. **概念混乱**：Pipeline 是模板概念，但 Task 直接引用 `pipeline_template_id`，缺少实例化的中间层
2. **状态混乱**：`TaskStatus` 混合了执行状态 (`running`, `completed`, `error`) 和流程状态 (`todo`, `in_progress`, `in_review`, `done`)
3. **层级缺失**：没有 Workflow（工作流实例）和 WorkNode（工作节点实例）的概念
4. **Agent 执行状态未独立**：Agent CLI 的执行状态与任务状态耦合

**现有数据库表结构**：
- `projects` - 项目
- `sessions` - 会话
- `tasks` - 任务（直接引用 `pipeline_template_id`）
- `messages` - 消息
- `global_task_pipeline_templates` / `projects_task_pipeline_templates` - 流水线模板
- `global_task_pipeline_template_stages` / `projects_task_pipeline_template_stages` - 流水线阶段模板

## Goals / Non-Goals

**Goals:**
- 建立清晰的层级结构：Project → Task → Workflow → WorkNode → AgentExecution
- 分离模板（Template）和实例（Instance）概念
- 分离流程状态和执行状态
- 支持 Agent CLI 的多轮对话状态跟踪
- 保持向后兼容，提供数据迁移方案

**Non-Goals:**
- 不支持非线性工作流（DAG、并行分支等）
- 不改变 Project 和 Session 的现有结构
- 不改变 Message 的存储方式

## Decisions

### 1. 重命名 Pipeline 为 Workflow

**决定**：将 `PipelineTemplate` 重命名为 `WorkflowTemplate`，`PipelineTemplateStage` 重命名为 `WorkNodeTemplate`

**理由**：
- "Workflow" 更准确地描述了任务执行方式的概念
- "WorkNode" 比 "Stage" 更能体现执行单元的含义
- 与 `docs/plan.md` 中的设计保持一致

**替代方案**：保留 Pipeline 命名 → 拒绝，因为与新设计文档不一致

### 2. 引入 Workflow 实例层

**决定**：新增 `workflows` 表，作为 WorkflowTemplate 的实例化

```
WorkflowTemplate (模板) → Workflow (实例)
WorkNodeTemplate (模板) → WorkNode (实例)
```

**理由**：
- 模板定义"如何做"，实例记录"正在做什么"
- 实例可以跟踪独立的状态和进度
- 支持同一模板被多个任务使用

**替代方案**：直接在 Task 上记录当前阶段 → 拒绝，无法支持复杂的状态跟踪

### 3. 状态分离设计

**决定**：定义三层独立的状态

| 层级 | 状态 | 说明 |
|------|------|------|
| Task | `todo` → `in_progress` → `in_review` → `done` | 任务整体进度 |
| WorkNode | `todo` → `in_progress` → `in_review` → `done` | 工作节点进度 |
| AgentExecution | `idle` → `running` → `completed` | Agent CLI 执行状态 |

**理由**：
- Task 状态反映整体进度，由 WorkNode 状态聚合决定
- WorkNode 状态反映单个节点的完成情况
- AgentExecution 状态反映 CLI 进程的运行状态，支持多轮对话

### 4. 数据库表结构设计

**决定**：新增以下表

```sql
-- 全局工作流模板（重命名自 global_task_pipeline_templates）
global_workflow_templates (
  id, name, description, created_at, updated_at
)

-- 全局工作节点模板（重命名自 global_task_pipeline_template_stages）
global_work_node_templates (
  id, workflow_template_id, node_order, name, prompt,
  requires_approval, continue_on_error, created_at, updated_at
)

-- 项目工作流模板（重命名自 projects_task_pipeline_templates）
project_workflow_templates (
  id, project_id, name, description, created_at, updated_at
)

-- 项目工作节点模板（重命名自 projects_task_pipeline_template_stages）
project_work_node_templates (
  id, workflow_template_id, node_order, name, prompt,
  requires_approval, continue_on_error, created_at, updated_at
)

-- 工作流实例（新增）
workflows (
  id, task_id, workflow_template_id, workflow_template_scope,
  current_node_index, status, created_at, updated_at
)
-- workflow_template_scope: 'global' | 'project'，标识模板来源

-- 工作节点实例（新增）
work_nodes (
  id, workflow_id, work_node_template_id, node_order,
  status, created_at, updated_at
)

-- Agent 执行记录（新增）
agent_executions (
  id, work_node_id, execution_index, status,
  started_at, completed_at, cost, duration, created_at
)
```

**理由**：
- 模板表保持全局/项目分离的设计
- 实例表与 Task 关联，支持状态跟踪
- AgentExecution 支持多轮对话记录

### 5. Task 表字段调整

**决定**：
- 移除 `pipeline_template_id` 字段
- 移除混合状态类型，Task.status 仅使用流程状态
- 新增 `workflow_id` 字段（可选，指向 workflows 表）

**理由**：
- Task 通过 workflow_id 关联工作流实例
- 简单任务可以没有工作流（workflow_id = null）

### 6. 迁移策略

**决定**：采用渐进式迁移

1. **Phase 1**：创建新表结构，保留旧表
2. **Phase 2**：迁移现有数据到新表
3. **Phase 3**：更新应用代码使用新表
4. **Phase 4**：删除旧表（可选，可保留一段时间）

**理由**：
- 降低迁移风险
- 支持回滚
- 不影响现有用户数据

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 数据迁移可能丢失数据 | 迁移前备份数据库，提供回滚脚本 |
| 新旧代码并存期间的复杂性 | 使用 feature flag 控制，分阶段发布 |
| 性能影响（多表 JOIN） | 添加适当索引，必要时使用缓存 |
| UI 组件大量修改 | 先重构数据层，UI 层渐进更新 |
