# VibeWork 定时任务自动化方案设计

## 1. 背景

当前 VibeWork 已具备任务创建、执行状态流转、CLI 会话执行等能力，但缺少"按时间自动触发任务"的能力，重复性任务（日报、巡检、自动代码检查等）仍需手动启动。

## 2. 目标

在不破坏现有任务体系的前提下，增加"定时运行任务"能力。

### 2.1 MVP 目标

- 支持创建、启停、编辑、删除定时任务规则
- 支持按计划自动创建并启动任务
- 支持手动"立即执行（Run now）"
- 支持运行记录查询（成功/失败/跳过）
- 仅支持 `conversation` 任务模式

### 2.2 暂不纳入 MVP

- 应用关闭后的后台守护执行
- 跨机器同步调度
- 复杂 RRULE 全量语法
- workflow 模式自动化（放在第二阶段）

## 3. 设计原则

- **复用现有执行链路**：复用 `TaskService`、`TaskExecutionService`、`CliSessionService`
- **最小侵入**：以新增服务与表为主，不重构现有主流程
- **可观测**：每次触发必须有 run 记录可追踪
- **幂等与防重**：同一计划时间点只能触发一次
- **可恢复**：应用重启后可从 `next_run_at` 恢复调度

## 4. 总体架构

新增两个主进程服务：

1. `AutomationService` — 生命周期服务，维护定时扫描器（每 30s），查找到期规则并投递执行
2. `AutomationRunnerService` — 负责单次触发的完整执行：创建任务 → 启动节点 → 拉起 CLI 会话 → 记录结果

### 4.1 核心执行流程

1. `AutomationService` 扫描 `enabled=1 AND next_run_at <= now`
2. 在同一事务中：创建 `automation_runs` 记录（状态 `running`），立即计算并写回下一次 `next_run_at`
3. 使用规则模板调用 `TaskService.createTask` 创建新任务（`task_mode=conversation`）
4. 调用 `DatabaseService.startTaskExecution` 启动任务，`CliSessionService.startSession` 拉起 CLI 会话
5. 会话结束后更新 run 状态：CLI 正常退出（exit code 0）→ `success`；异常退出或出错 → `failed`。节点进入 `in_review` 后由用户手动审批，不属于自动化范围

## 5. 数据模型

> `automations` 和 `automation_runs` 均属于**持久化表**（与 `projects`、`workflow_templates` 同级），版本升级时不可 DROP 重建。

### 5.1 `automations`

- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL`
- `enabled INTEGER NOT NULL DEFAULT 1`
- `trigger_type TEXT NOT NULL`（`interval` / `daily` / `weekly`）
- `trigger_json TEXT NOT NULL`（触发参数，结构见下方）
- `timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'`
- `source_task_id TEXT`（可选：基于现有任务克隆）
- `template_json TEXT NOT NULL`（执行参数快照，结构见下方）
- `next_run_at TEXT NOT NULL`
- `last_run_at TEXT`
- `last_status TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

索引：`INDEX idx_automations_enabled_next_run ON automations(enabled, next_run_at)`

#### `trigger_json` 结构

```jsonc
// interval
{ "interval_seconds": 3600 }

// daily
{ "time": "09:00" }

// weekly
{ "day_of_week": 1, "time": "09:00" }  // 1=周一, 7=周日
```

#### `template_json` 结构

对齐 `CreateTaskOptions` 接口：

```jsonc
{
  "title": "每日代码检查",
  "prompt": "检查代码质量并生成报告",
  "taskMode": "conversation",
  "projectId": "01ABC...",
  "projectPath": "/path/to/project",
  "createWorktree": true,
  "baseBranch": "main",
  "worktreeBranchPrefix": "auto/",
  "cliToolId": "claude-code",
  "agentToolConfigId": null
}
```

### 5.2 `automation_runs`

- `id TEXT PRIMARY KEY`
- `automation_id TEXT NOT NULL`
- `scheduled_at TEXT NOT NULL`
- `triggered_at TEXT NOT NULL`
- `status TEXT NOT NULL`（`running` / `success` / `failed` / `skipped`）
- `task_id TEXT`
- `task_node_id TEXT`
- `session_id TEXT`
- `error_message TEXT`
- `finished_at TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

约束与索引：

- `UNIQUE (automation_id, scheduled_at)`（防重复触发）
- `INDEX idx_runs_automation_created ON automation_runs(automation_id, created_at)`

## 6. 与现有模块的集成

### 6.1 AppContext 生命周期

将 `AutomationService` 加入 `serviceOrder`，随应用启动和退出自动管理。

- `init()`：启动扫描定时器；将所有遗留的 `status='running'` 的 run 标记为 `failed`（应用崩溃恢复）
- `dispose()`：清除扫描定时器

### 6.2 执行链路复用

- 任务创建：`TaskService.createTask`
- 启动执行：`DatabaseService.startTaskExecution`（内部委托 `TaskExecutionService`）
- CLI 会话：`CliSessionService.startSession`

### 6.3 会话结束监听

`AutomationRunnerService` 在主进程内监听事件完成闭环：

- `DatabaseService.onTaskNodeStatusChange`：节点进入 `in_review` 或 `done` 时更新 run 为 `success`
- `CliSessionService` 的 `error` / `close` 事件：异常时更新 run 为 `failed`

上述监听均在主进程内完成，不依赖渲染进程窗口状态。

### 6.4 IPC 扩展

新增 `automation` 命名空间：

- `automation:create` / `update` / `delete` / `get` / `list`
- `automation:setEnabled`
- `automation:runNow`
- `automation:listRuns`

### 6.5 前端页面设计

#### 入口

在侧边栏（`app-sidebar.tsx`）新增 `Automations` 导航项，路由 `/automations`，与 `/tasks`、`/dashboard` 同级。

#### 页面结构

新增 `pages/automations/AutomationsPage.tsx`，采用上下两区布局：

```
┌──────────────────────────────────────────────┐
│ 顶部操作栏                                     │
│  [+ 新建规则]                    [搜索] [筛选]  │
├──────────────────────────────────────────────┤
│ 规则列表                                       │
│ ┌──────────────────────────────────────────┐ │
│ │ 📋 每日代码检查        daily 09:00       │ │
│ │ 项目: my-project       上次: 成功 2h前    │ │
│ │                    [立即执行] [启停开关]   │ │
│ ├──────────────────────────────────────────┤ │
│ │ 📋 每周巡检报告        weekly 周一 10:00  │ │
│ │ 项目: backend          上次: 失败 3d前    │ │
│ │                    [立即执行] [启停开关]   │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

#### 交互流程

**新建/编辑规则**：点击「新建规则」或列表项，弹出 `Dialog`，表单字段：

| 字段 | 组件 | 说明 |
|------|------|------|
| 规则名称 | Input | 必填 |
| 触发方式 | Select (`interval` / `daily` / `weekly`) | 必填，切换后显示对应参数 |
| 触发参数 | Input（间隔秒数）/ TimePicker / DayOfWeek + TimePicker | 根据触发方式动态渲染 |
| 时区 | Select | 默认 `Asia/Shanghai` |
| 项目 | ProjectSelector | 必填，复用现有项目选择组件 |
| CLI 工具 | Select | 复用 `TaskCreateMenu` 中的工具选择逻辑 |
| 任务标题 | Input | 支持 `{{date}}` 等模板变量 |
| 任务提示词 | Textarea | 必填 |

**运行记录**：点击规则列表项展开或跳转详情，显示该规则的 `automation_runs` 列表：

| 列 | 说明 |
|----|------|
| 计划时间 | `scheduled_at` |
| 触发时间 | `triggered_at` |
| 状态 | `running` / `success` / `failed` / `skipped`，带颜色标识 |
| 关联任务 | 可点击跳转到 `/task/:taskId` |
| 错误信息 | `failed` 时显示 |

#### 文件组织

```
src/renderer/src/
├── pages/automations/
│   ├── AutomationsPage.tsx          # 页面主组件
│   └── components/
│       ├── AutomationList.tsx       # 规则列表
│       ├── AutomationItem.tsx       # 单条规则卡片
│       ├── AutomationFormDialog.tsx # 新建/编辑表单弹窗
│       └── AutomationRunList.tsx    # 运行记录列表
├── components/automation/
│   └── TriggerBadge.tsx             # 触发方式标签（interval/daily/weekly）
└── types/automation.ts              # 自动化相关类型定义
```

## 7. 调度策略

- 扫描周期：默认 30 秒
- 单规则互斥：同一规则存在 `running` 状态的 run 时跳过
- 全局并发上限：MVP 阶段限制为 1
- 错过触发补偿：应用恢复后对 `next_run_at <= now` 的规则补跑一次

## 8. 错误处理

- 失败写入 `automation_runs.error_message`
- `automations.last_status` / `last_run_at` 每次 run 结束后更新
- 可选：失败时调用 `NotificationService.notifyError`
- 日志前缀：`[AutomationService]`、`[AutomationRunnerService]`

## 9. 数据迁移策略

当前 schema 版本升级存在 DROP 运行时表重建的行为。建议先完成增量 migration 框架再接入自动化表：

1. 引入迁移函数列表（v3 → v4 → v5 ...）
2. 每个版本只执行增量 SQL
3. 禁止对 `tasks` / `task_nodes` 做破坏性重建

## 10. 实施计划

### Phase 0（基础）

- 完成 DB 增量迁移框架
- 创建 `automations` / `automation_runs` 表

### Phase 1（MVP）

- 实现 `AutomationService` 扫描调度
- 实现 `AutomationRunnerService` 执行闭环
- IPC：CRUD + runNow + listRuns
- 前端最小入口

### Phase 2（增强）

- workflow 模式支持
- 失败重试策略
- 并发配额与队列

## 11. 验收标准（MVP）

- 能创建并保存一个每日定时规则
- 到达触发时间后自动创建任务并执行
- `automation_runs` 可看到完整运行记录
- 失败场景有错误信息且不会无限重试
- 应用重启后规则状态与下一次触发时间正确恢复

## 12. 风险与应对

| 风险 | 应对 |
|------|------|
| 重复触发 | `UNIQUE (automation_id, scheduled_at)` + 事务插入 |
| 执行链路与 UI 耦合 | 主进程补齐自动执行入口 |
| 版本升级数据损坏 | 优先完成 migration 重构，新表归入持久化表 |
| 应用未运行时不执行 | MVP 阶段 UI 明确告知；Phase 2+ 引入后台守护 |
| 崩溃后 run 状态孤儿 | `init()` 时将遗留 `running` 标记为 `failed` |
