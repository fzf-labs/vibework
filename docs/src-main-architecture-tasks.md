# src/main 架构优化任务清单

> 创建日期: 2026-02-03

## 概述

本文档记录 `src/main` 目录架构的待优化项，按优先级排列。

---

## 当前目录结构

```
src/main/
├── index.ts
├── app/
│   ├── AppContext.ts
│   └── create-app-context.ts
├── config/
│   └── index.ts
├── types/
│   └── log.ts
├── utils/
│   ├── db-backup.ts
│   ├── fs-allowlist.ts
│   ├── ids.ts
│   ├── ipc-response.ts
│   ├── output-buffer.ts
│   ├── output-spooler.ts
│   ├── safe-exec.ts
│   ├── security-audit.ts
│   └── url-guard.ts
├── services/
│   ├── AppPaths.ts           ⚠️ 位置不当
│   ├── DataBatcher.ts        ⚠️ 位置不当
│   ├── CLIProcessService.ts
│   ├── CLIToolConfigService.ts
│   ├── CLIToolDetectorService.ts
│   ├── ClaudeCodeService.ts
│   ├── DatabaseService.ts    ⚠️ 过大 (1192行)
│   ├── EditorService.ts
│   ├── GitService.ts
│   ├── LogNormalizerService.ts
│   ├── MsgStoreService.ts
│   ├── NotificationService.ts
│   ├── PipelineService.ts
│   ├── PreviewConfigService.ts
│   ├── PreviewService.ts
│   ├── ProjectService.ts
│   ├── SettingsService.ts
│   ├── TaskService.ts
│   ├── cli/
│   │   ├── CliSessionService.ts
│   │   ├── ProcessCliSession.ts
│   │   ├── types.ts
│   │   └── adapters/
│   └── normalizers/
└── ipc/
    ├── index.ts
    ├── types.ts
    └── *.ipc.ts (16个文件)
```

---

## 任务清单

### P1 - 高优先级

#### 任务 1.1: 移动 DataBatcher 到 utils/

**状态:** 待完成

**原因:** `DataBatcher` 是通用工具类，用于数据批处理，不是业务服务。

**操作:**
1. 移动 `src/main/services/DataBatcher.ts` → `src/main/utils/data-batcher.ts`
2. 更新所有引用路径

**影响文件:**
- `src/main/services/CLIProcessService.ts`
- `src/main/services/ClaudeCodeService.ts`
- `src/main/services/cli/ProcessCliSession.ts`

---

#### 任务 1.2: 移动 AppPaths 到 app/

**状态:** 待完成

**原因:** `AppPaths` 是单例工具类，管理应用路径，属于应用基础设施，不是业务服务。

**操作:**
1. 移动 `src/main/services/AppPaths.ts` → `src/main/app/AppPaths.ts`
2. 更新所有引用路径

**影响文件:**
- `src/main/app/create-app-context.ts`
- `src/main/app/AppContext.ts`
- `src/main/ipc/types.ts`
- `src/main/services/DatabaseService.ts`
- `src/main/services/CLIProcessService.ts`
- `src/main/services/PipelineService.ts`
- `src/main/services/MsgStoreService.ts`
- `src/main/services/SettingsService.ts`
- `src/main/services/TaskService.ts`

---

### P2 - 中优先级

#### 任务 2.1: 拆分 DatabaseService

**状态:** 待完成

**原因:** `DatabaseService.ts` 有 1192 行，包含 6 个领域的 CRUD 操作，违反单一职责原则。

**当前职责:**
| 领域 | 方法数 | 说明 |
|------|--------|------|
| Task | 10+ | 任务 CRUD + 状态管理 |
| Project | 6 | 项目 CRUD |
| WorkflowTemplate | 8 | 工作流模板 CRUD |
| Workflow | 5 | 工作流实例管理 |
| WorkNode | 10+ | 工作节点状态管理 |
| AgentExecution | 4 | Agent 执行记录 |

**建议拆分（最优方案）:**
```
src/main/services/database/
├── DatabaseConnection.ts    # 连接管理、表初始化（仅 DB 级职责）
├── DatabaseMaintenance.ts   # legacy 检测、备份/恢复、reset 与用户确认（依赖 UI）
├── TaskRepository.ts        # Task CRUD
├── ProjectRepository.ts     # Project CRUD
├── WorkflowRepository.ts    # Workflow + WorkNode + Template
├── AgentRepository.ts       # AgentExecution CRUD
└── index.ts                 # 统一导出 DatabaseService
```

**操作步骤:**
1. 创建 `services/database/` 目录
2. 提取 `DatabaseConnection.ts` - 连接管理和表初始化（不含 UI/备份）
3. 提取 `DatabaseMaintenance.ts` - legacy 检测、备份/恢复、reset、确认弹窗
4. 提取 `TaskRepository.ts` - Task 相关方法
5. 提取 `ProjectRepository.ts` - Project 相关方法
6. 提取 `WorkflowRepository.ts` - Workflow 相关方法
7. 提取 `AgentRepository.ts` - AgentExecution 相关方法
8. 在 `DatabaseService`(facade) 保留跨域编排与事件分发逻辑（如 seedWorkflow、状态监听、agent 同步）
9. 创建 `index.ts` 组合导出
10. 更新所有引用

**注意事项:**
- 保留 `DatabaseService` 作为 facade，避免影响 IPC 与 AppContext 的依赖
- Repository 只做 CRUD；流程编排与聚合操作放在 facade

---

### P3 - 低优先级

#### 任务 3.1: 统一 types/ 目录

**状态:** 待完成

**原因:** 当前 `types/` 目录只有 `log.ts`，其他类型分散在各服务文件中，容易产生类型漂移。

**建议结构:**
```
src/main/types/
├── index.ts          # 统一导出
├── log.ts            # 日志类型 (已有)
├── db/               # 数据库行类型（snake_case）
│   ├── task.ts       # DbTask, CreateTaskInput, UpdateTaskInput
│   ├── project.ts    # DbProject, CreateProjectInput, UpdateProjectInput
│   ├── workflow.ts   # DbWorkflow, DbWorkflowTemplate, DbWorkNode
│   └── agent.ts      # DbAgentExecution
└── domain/           # 业务类型（camelCase）
    ├── task.ts       # Task, CreateTaskOptions
    ├── project.ts    # Project, CreateProjectOptions
    ├── workflow.ts   # Workflow, WorkflowTemplate, WorkNode
    └── agent.ts      # AgentExecution
```

**操作步骤:**
1. 从 `DatabaseService.ts` 提取 DB 行类型到 `types/db/`
2. 保留服务层对外类型在 `types/domain/`
3. 更新所有服务的类型引用（显式区分 Db* 与 Domain 类型）

---

## 最优架构设计

**目标:** 降低耦合、明确分层、保证迁移安全与可回滚。

**分层与职责:**
- `app/`：应用级组装与生命周期管理（AppContext、create-app-context）。
- `services/`：业务编排与对外 API（保留 `DatabaseService` facade）。
- `services/database/`：仅数据访问与存储职责（Repositories + Connection + Maintenance）。
- `utils/`：纯工具与无状态能力（无业务概念）。
- `types/`：类型分层（`db/` snake_case 与 `domain/` camelCase）。
- `ipc/`：依赖 facade 接口，不直接依赖 repositories。

**依赖规则:**
- `utils/` 不依赖 `services/` 或 `app/`。
- `services/database/*Repository` 仅依赖 `DatabaseConnection` 与 `types/db/*`。
- `DatabaseMaintenance` 允许依赖 UI（dialog）与备份工具。
- `DatabaseService` facade 负责跨域编排与事件分发（seed workflow、状态监听、agent 同步）。
- `services/*` 只依赖 facade（避免横向依赖 repositories）。

**命名约定:**
- 数据库行类型：`DbTask/DbProject/...`（snake_case 字段）。
- 业务类型：`Task/Project/...`（camelCase 字段）。
- 工具文件：`kebab-case`，服务类：`PascalCase`。

---

## 目标目录结构

完成所有任务后的目标结构：

```
src/main/
├── index.ts
├── app/
│   ├── AppContext.ts
│   ├── create-app-context.ts
│   └── AppPaths.ts              # P1 移入
├── config/
│   └── index.ts
├── types/                        # P3 扩展
│   ├── index.ts
│   ├── log.ts
│   ├── db/
│   │   ├── task.ts
│   │   ├── project.ts
│   │   ├── workflow.ts
│   │   └── agent.ts
│   └── domain/
│       ├── task.ts
│       ├── project.ts
│       ├── workflow.ts
│       └── agent.ts
├── utils/
│   ├── data-batcher.ts          # P1 移入
│   ├── db-backup.ts
│   ├── output-buffer.ts
│   └── ...
├── services/
│   ├── database/                 # P2 拆分
│   │   ├── DatabaseConnection.ts
│   │   ├── DatabaseMaintenance.ts
│   │   ├── TaskRepository.ts
│   │   ├── ProjectRepository.ts
│   │   ├── WorkflowRepository.ts
│   │   ├── AgentRepository.ts
│   │   └── index.ts
│   ├── cli/
│   ├── normalizers/
│   └── ...其他服务
└── ipc/
```

---

## 最终方案

**实施顺序（最优路径）:**
1. P1：移动 `DataBatcher` 与 `AppPaths`（小步改动、最小风险）。
2. P2：拆分 `DatabaseService`（先 Connection/Maintenance，再 Repositories，最后 facade 编排）。
3. P3：类型分层（先 `types/db`，再 `types/domain`，最后统一引用）。

**验收标准:**
- 所有 IPC 与 AppContext 继续通过 `DatabaseService` facade 工作。
- 不新增跨层依赖（utils 不依赖 services/app）。
- 数据库迁移/备份/恢复行为与现有一致。
- 业务类型与数据库类型命名清晰且不混用。

---

## 进度跟踪

| 任务 | 优先级 | 状态 | 完成日期 |
|------|--------|------|----------|
| 1.1 移动 DataBatcher | P1 | 完成 | 2026-02-03 |
| 1.2 移动 AppPaths | P1 | 完成 | 2026-02-03 |
| 2.1 拆分 DatabaseService | P2 | 完成 | 2026-02-03 |
| 3.1 统一 types/ | P3 | 完成 | 2026-02-03 |
