# 核心概念

## 1. 项目 (Project)
- 顶层容器，包含多个任务

## 2. 任务 (Task)
- 项目中的具体工作项
- **状态流转**: `todo` → `in_progress` → `in_review` → `done`

## 3. 工作流 (Workflow)
- 定义任务的执行方式，由多个工作节点按顺序组成
- 目前仅支持线性工作流结构
- 每个工作流中必须有一个工作节点。主要目的是为了简化系统的复杂度.
- 全局工作流:整个应用都可以用来复用的工作流.包含增山改查功能.
- 项目工作流:每个项目都可以自定义工作流.同时可以去全局工作流中复制一个过来,方便项目井工作流的创建.

### 工作流类型
| 类型 | 说明 |
|------|------|
| 单节点工作流 | 只有一个默认节点 |
| Spec 工作流 | 规范驱动开发 (Spec-Driven Development) |
| BMAD 工作流 | BMAD 方法论 |
| TDD 工作流 | 测试驱动开发 (Test-Driven Development) |

## 4. 工作节点 (Work Node)
- 工作流中的单个执行单元
- 每个工作节点都有自己的标题,提示词(预设制的)
- 通过调用 Agent CLI 完成具体工作
- **状态流转**: `todo` → `in_progress` → `in_review` → `done`

## 5. Agent CLI
- 实际执行工作的命令行工具
- Agent ClI 在最终执行的时候,它的提示词需要结合任务和任务节点二者合一构成一个最终提示词。
- **支持的工具**: Claude Code、Codex、Cursor Agent 等

### Agent CLI 执行状态
| 状态 | 说明 |
|------|------|
| `idle` | 未执行 |
| `running` | 执行中（对话进行中） |
| `completed` | 执行完成 |

> **注意**: Agent CLI 支持多轮对话。在对话过程中状态为 `running`，对话结束后变为 `completed`。
> 状态会在 `running` ↔ `completed` 之间循环切换。

---

## 层级关系

```
Project
└── Task (状态: todo → in_progress → in_review → done)
    └── Workflow (工作流类型)
        └── Work Node (状态: todo → in_progress → in_review → done)
            └── Agent CLI (状态: idle → running → completed)
```



## Task + Work Node + Agent CLI 执行过程中状态流转说明

### 状态定义

| 层级 | 状态值 | 说明 |
|------|--------|------|
| Task | `todo` | 任务待开始 |
| Task | `in_progress` | 任务进行中 |
| Task | `in_review` | 任务待审核 |
| Task | `done` | 任务已完成 |
| Work Node | `todo` | 节点待执行 |
| Work Node | `in_progress` | 节点执行中 |
| Work Node | `in_review` | 节点待审核 |
| Work Node | `done` | 节点已完成 |
| Agent CLI | `idle` | Agent 空闲，未执行 |
| Agent CLI | `running` | Agent 执行中 |
| Agent CLI | `completed` | Agent 执行完成 |


### 状态联动原则

**原则1: Agent CLI → Work Node（自动联动）**

| Agent CLI 状态 | Work Node 状态 | 说明 |
|----------------|----------------|------|
| `idle` | 不联动 | 空闲状态不触发联动 |
| `running` | `in_progress` | 开始执行时同步 |
| `completed` | `in_review` | 执行完成时同步 |

> Agent CLI 状态变化时，自动同步更新当前 Work Node 状态（`idle` 除外）

**原则2: Work Node → Task（自动联动）**

| 条件 | Task 状态 | 说明 |
|------|-----------|------|
| 任意 Work Node = `in_progress` | `in_progress` | 有节点在执行 |
| 任意 Work Node = `in_review` 且无 `in_progress` | `in_progress` | 有节点待审核，任务仍在进行 |
| 最后一个 Work Node = `done` | `in_review` | 所有节点完成，任务待审核 |

**原则3: 用户操作触发状态变化**

| 用户操作 | 直接影响 |
|----------|----------|
| 点击"开始任务" | Agent CLI: `idle` → `running` |
| Agent 对话结束 | Agent CLI: `running` → `completed` |
| 继续对话 | Agent CLI: `completed` → `running` |
| 确认节点完成 | Work Node: `in_review` → `done` |
| 审核任务通过 | Task: `in_review` → `done` |

**原则4: 异常场景处理**

| 异常场景 | Agent CLI | Work Node | Task | 说明 |
|----------|-----------|-----------|------|------|
| Agent 执行出错 | → `completed` | → `in_review` | 不变 | 用户可查看错误后重试 |
| 用户中断执行 | → `completed` | → `in_review` | 不变 | 用户可继续或确认完成 |

> 异常情况下不使用特殊状态，统一进入 `in_review` 状态，由用户决定后续操作（重试或跳过）

### 执行流程状态变化

```
场景：工作流包含 3 个 Work Node

1. 初始状态
   Task: todo
   Work Node[0]: todo, Work Node[1]: todo, Work Node[2]: todo
   Agent CLI: idle

2. 用户点击"开始任务"
   → Agent CLI: idle → running
   → Work Node[0]: todo → in_progress (原则1自动联动)
   → Task: todo → in_progress (原则2自动联动)

3. Agent CLI 执行完成
   → Agent CLI: running → completed
   → Work Node[0]: in_progress → in_review (原则1自动联动)
   → Task: 保持 in_progress

4. 用户继续对话（可选，可多轮）
   → Agent CLI: completed → running → completed（循环）
   → Work Node[0]: in_review → in_progress → in_review（跟随联动）

5. 用户确认节点0完成
   → Work Node[0]: in_review → done
   → 自动切换到下一节点，Agent CLI: idle → running
   → Work Node[1]: todo → in_progress (原则1自动联动)
   → Task: 保持 in_progress

6. 重复步骤3-5，直到最后一个节点

7. 用户确认最后节点完成
   → Work Node[2]: in_review → done
   → Task: in_progress → in_review (原则2: 最后节点done)

8. 用户审核任务通过
   → Task: in_review → done
```

### 状态联动规则汇总

| 触发事件 | Agent CLI | Work Node（当前） | Task |
|----------|-----------|-------------------|------|
| 开始任务 | → `running` | → `in_progress` | → `in_progress` |
| Agent 完成 | → `completed` | → `in_review` | 不变 |
| 继续对话 | → `running` | → `in_progress` | 不变 |
| 确认节点完成 | 下一个 → `running` | 当前 → `done`，下一个 → `in_progress` | 不变 |
| 确认最后节点完成 | 保持 `completed` | → `done` | → `in_review` |
| 审核通过 | 不变 | 不变 | → `done` |
