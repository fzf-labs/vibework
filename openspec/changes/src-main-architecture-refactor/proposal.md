## Why

`src/main` 目录存在架构问题：工具类混入 services/、DatabaseService 过大（1192行，6个领域）、类型定义分散。这些问题导致代码难以维护和测试，违反单一职责原则。

## What Changes

- 移动 `DataBatcher` 从 `services/` 到 `utils/`（通用批处理工具类）
- 移动 `AppPaths` 从 `services/` 到 `app/`（应用基础设施）
- 拆分 `DatabaseService` 为多个 Repository（TaskRepository、ProjectRepository、WorkflowRepository、AgentRepository）
- 集中类型定义到 `types/` 目录

## Capabilities

### New Capabilities

- `database-repository-pattern`: 将 DatabaseService 拆分为独立的 Repository 模块，每个 Repository 负责单一领域的 CRUD 操作

### Modified Capabilities

<!-- 无现有 spec 需要修改 -->

## Impact

- **代码文件**：
  - `src/main/services/DataBatcher.ts` → `src/main/utils/data-batcher.ts`
  - `src/main/services/AppPaths.ts` → `src/main/app/AppPaths.ts`
  - `src/main/services/DatabaseService.ts` → `src/main/services/database/` 目录
- **引用更新**：约 12 个文件需要更新 import 路径
- **API 兼容**：保留 DatabaseService 作为 facade，IPC 层无需修改
