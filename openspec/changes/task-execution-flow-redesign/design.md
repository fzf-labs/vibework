## Context

当前系统中任务(Task)和工作流(Workflow)是两个相对独立的概念：
- 任务有自己的状态机：todo → in_progress → in_review → done
- 工作流有自己的状态机和节点执行逻辑
- 两者之间缺乏自动化的联动机制

现有实现的问题：
1. 任务状态变更不会自动触发工作流执行
2. 工作节点的审核状态没有对应的UI界面
3. 用户无法直观看到工作流的执行进度
4. 任务必须设置工作流才能执行，缺乏灵活性

## Goals / Non-Goals

**Goals:**
- 实现任务状态与工作流执行的自动联动
- 提供完整的工作节点审核UI界面
- 可视化展示工作流执行进度
- 支持无工作流的简单任务执行模式

**Non-Goals:**
- 不修改现有数据模型结构
- 不改变工作流模板的管理方式
- 不实现并行节点执行（保持顺序执行）
- 不实现跨任务的工作流依赖

## Decisions

### Decision 1: 任务状态变更触发机制

**选择**: 在 DatabaseService.updateTask 中增加状态变更钩子

**理由**:
- 集中化处理，所有任务状态变更都经过此入口
- 避免在多处UI代码中重复实现触发逻辑
- 便于后续扩展其他状态变更事件

**替代方案**:
- 在 useAgent hook 中处理 → 分散，难以维护
- 使用事件总线 → 增加复杂度，当前规模不需要

### Decision 2: 工作流自动启动策略

**选择**: todo → in_progress 时自动实例化并启动工作流

**流程**:
```
Task.status: todo → in_progress
  ↓
检查 task.workflow_template_id
  ↓ (有模板)
创建 Workflow 实例 (status: in_progress)
  ↓
创建所有 WorkNode 实例 (status: todo)
  ↓
启动第一个 WorkNode (status: in_progress)
```

**理由**:
- 符合用户预期：开始任务即开始执行
- 延迟实例化，避免创建未使用的工作流

### Decision 3: 审核UI架构

**选择**: 独立的 WorkNodeReviewPanel 组件，嵌入 TaskDetail 页面

**组件结构**:
```
TaskDetail
├── WorkflowProgressBar (顶部进度条)
├── MessageList (消息列表)
└── WorkNodeReviewPanel (审核面板，条件渲染)
    ├── NodeInfo (节点信息)
    ├── ExecutionOutput (执行输出)
    └── ActionButtons (批准/拒绝按钮)
```

**理由**:
- 审核是任务执行的一部分，不应跳转到独立页面
- 条件渲染减少不必要的UI复杂度

### Decision 4: 状态同步方向

**选择**: 双向同步，以工作流状态为主

**同步规则**:
| 工作流状态 | 任务状态 |
|-----------|---------|
| in_progress | in_progress |
| 任一节点 in_review | in_review |
| done | done |
| error | error |

**理由**:
- 工作流状态更精确地反映实际执行情况
- 任务状态作为工作流状态的聚合视图

### Decision 5: 强制工作流模板

**选择**: 所有任务必须设置工作流模板才能执行

**理由**:
- 确保所有任务都有明确的执行流程
- 统一任务执行路径，简化代码逻辑
- 便于追踪和审核任务执行过程

**替代方案**:
- 支持无工作流任务 → 增加代码分支，维护成本高

## Risks / Trade-offs

**[Risk] 状态同步可能产生竞态条件**
→ Mitigation: 使用数据库事务确保原子性更新

**[Risk] 审核面板可能阻塞用户操作**
→ Mitigation: 审核面板使用非模态设计，用户可继续查看消息

**[Risk] 工作流自动启动可能导致意外执行**
→ Mitigation: 仅在用户明确点击"开始"按钮时触发状态变更

**[Trade-off] 双向状态同步增加复杂度**
→ Accept: 为了保持UI一致性，这是必要的复杂度

**[Trade-off] 审核UI嵌入TaskDetail增加页面复杂度**
→ Accept: 比跳转到独立页面的用户体验更好
