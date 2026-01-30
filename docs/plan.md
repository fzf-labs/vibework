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
