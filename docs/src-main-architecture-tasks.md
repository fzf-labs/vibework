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
- `src/main/services/MsgStoreService.ts`

---

#### 任务 1.2: 移动 AppPaths 到 app/

**状态:** 待完成

**原因:** `AppPaths` 是单例工具类，管理应用路径，属于应用基础设施，不是业务服务。

**操作:**
1. 移动 `src/main/services/AppPaths.ts` → `src/main/app/AppPaths.ts`
2. 更新所有引用路径

**影响文件:**
- `src/main/app/create-app-context.ts`
- `src/main/services/DatabaseService.ts`
- `src/main/services/CLIProcessService.ts`
- `src/main/services/MsgStoreService.ts`
- `src/main/services/SettingsService.ts`
- `src/main/services/TaskService.ts`

---

### P2 - 中优先级

#### 任务 2.1: 拆分 DatabaseService

**状态:** 待完成

**原因:** `DatabaseService.ts` 有 1192 行，包含 5 个领域的 CRUD 操作，违反单一职责原则。

**当前职责:**
| 领域 | 方法数 | 说明 |
|------|--------|------|
| Task | 10+ | 任务 CRUD + 状态管理 |
| Project | 6 | 项目 CRUD |
| WorkflowTemplate | 8 | 工作流模板 CRUD |
| Workflow | 5 | 工作流实例管理 |
| WorkNode | 10+ | 工作节点状态管理 |
| AgentExecution | 4 | Agent 执行记录 |

**建议拆分:**
```
src/main/services/database/
├── DatabaseConnection.ts    # 连接管理、表初始化
├── TaskRepository.ts        # Task CRUD
├── ProjectRepository.ts     # Project CRUD
├── WorkflowRepository.ts    # Workflow + WorkNode + Template
├── AgentRepository.ts       # AgentExecution CRUD
└── index.ts                 # 统一导出 DatabaseService
```

**操作步骤:**
1. 创建 `services/database/` 目录
2. 提取 `DatabaseConnection.ts` - 连接管理和表初始化
3. 提取 `TaskRepository.ts` - Task 相关方法
4. 提取 `ProjectRepository.ts` - Project 相关方法
5. 提取 `WorkflowRepository.ts` - Workflow 相关方法
6. 创建 `index.ts` 组合导出
7. 更新所有引用

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
├── task.ts           # Task, CreateTaskInput, UpdateTaskInput
├── project.ts        # Project, CreateProjectInput, UpdateProjectInput
├── workflow.ts       # Workflow, WorkflowTemplate, WorkNode
└── agent.ts          # AgentExecution
```

**操作步骤:**
1. 从 `DatabaseService.ts` 提取类型定义
2. 创建对应的类型文件
3. 更新所有服务的类型引用

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
│   ├── task.ts
│   ├── project.ts
│   ├── workflow.ts
│   └── agent.ts
├── utils/
│   ├── data-batcher.ts          # P1 移入
│   ├── db-backup.ts
│   ├── output-buffer.ts
│   └── ...
├── services/
│   ├── database/                 # P2 拆分
│   │   ├── DatabaseConnection.ts
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

## 进度跟踪

| 任务 | 优先级 | 状态 | 完成日期 |
|------|--------|------|----------|
| 1.1 移动 DataBatcher | P1 | 待完成 | - |
| 1.2 移动 AppPaths | P1 | 待完成 | - |
| 2.1 拆分 DatabaseService | P2 | 待完成 | - |
| 3.1 统一 types/ | P3 | 待完成 | - |
