## Context

`src/main` 目录当前存在以下问题：

1. **工具类位置不当**：`DataBatcher`（通用批处理）和 `AppPaths`（路径管理）放在 `services/` 目录，与业务服务混淆
2. **DatabaseService 过大**：1192 行代码，包含 Task、Project、Workflow、WorkNode、AgentExecution 等 6 个领域的 CRUD 操作
3. **类型定义分散**：类型定义在 DatabaseService.ts 开头约 150 行，难以复用

当前依赖关系：
- IPC 层 → DatabaseService（facade）
- AppContext → AppPaths
- 多个 Service → DataBatcher

## Goals / Non-Goals

**Goals:**
- 将工具类移动到正确的目录位置
- 将 DatabaseService 拆分为独立的 Repository 模块
- 保持 API 兼容性，IPC 层无需修改

**Non-Goals:**
- 不修改 IPC 层的调用方式
- 不引入新的 ORM 或数据库抽象层
- 不修改数据库 schema

## Decisions

### Decision 1: DataBatcher 移动到 utils/

**选择**：移动到 `src/main/utils/data-batcher.ts`

**理由**：DataBatcher 是纯工具类，无业务依赖，符合 utils/ 的定位。

**替代方案**：保持在 services/ → 拒绝，因为它不是业务服务

### Decision 2: AppPaths 移动到 app/

**选择**：移动到 `src/main/app/AppPaths.ts`

**理由**：AppPaths 管理应用级路径，与 AppContext 同属应用初始化层。

**替代方案**：移动到 config/ → 拒绝，config/ 用于配置值，不是路径管理

### Decision 3: DatabaseService 拆分为 Repository 模式

**选择**：创建 `src/main/services/database/` 目录，包含：
- `DatabaseConnection.ts` - 连接管理、表初始化
- `TaskRepository.ts` - Task CRUD
- `ProjectRepository.ts` - Project CRUD
- `WorkflowRepository.ts` - Workflow + WorkNode + Template
- `AgentRepository.ts` - AgentExecution CRUD
- `index.ts` - 导出 DatabaseService facade

**理由**：
1. 符合单一职责原则
2. 便于单元测试
3. 保留 facade 模式，IPC 层无需修改

**替代方案**：
- 使用 ORM → 拒绝，引入过多复杂性
- 按表拆分 → 拒绝，WorkNode 和 Workflow 关系紧密，应放在一起

### Decision 4: 类型定义集中管理

**选择**：在 `src/main/types/` 创建独立类型文件

**理由**：便于类型复用，避免循环依赖

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 重构过程中引入 bug | 分步执行，每步验证编译通过 |
| import 路径更新遗漏 | 使用 TypeScript 编译器检查 |
| Repository 间事务问题 | 当前无跨 Repository 事务需求，暂不处理 |

## Migration Plan

1. **P1 阶段**（可并行）：
   - 移动 DataBatcher，更新 3 个引用文件
   - 移动 AppPaths，更新 9 个引用文件

2. **P2 阶段**：
   - 创建 database/ 目录结构
   - 逐个提取 Repository
   - 保留 DatabaseService facade

3. **P3 阶段**（可选）：
   - 集中类型定义

**回滚策略**：每个 PR 独立，可单独回滚
