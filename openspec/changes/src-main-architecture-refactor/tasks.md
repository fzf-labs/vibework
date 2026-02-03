## 1. P1 - 移动工具类

- [x] 1.1 移动 DataBatcher 到 `src/main/utils/data-batcher.ts`
- [x] 1.2 更新 CLIProcessService.ts 的 DataBatcher 导入路径
- [x] 1.3 更新 ClaudeCodeService.ts 的 DataBatcher 导入路径
- [x] 1.4 更新 cli/ProcessCliSession.ts 的 DataBatcher 导入路径
- [x] 1.5 移动 AppPaths 到 `src/main/app/AppPaths.ts`
- [x] 1.6 更新所有 AppPaths 引用文件的导入路径（9个文件）
- [x] 1.7 验证 TypeScript 编译通过

## 2. P2 - 创建 Database 目录结构

- [x] 2.1 创建 `src/main/services/database/` 目录
- [x] 2.2 创建 DatabaseConnection.ts - 提取连接管理和表初始化逻辑
- [x] 2.3 创建 TaskRepository.ts - 提取 Task CRUD 方法
- [x] 2.4 创建 ProjectRepository.ts - 提取 Project CRUD 方法
- [x] 2.5 创建 WorkflowRepository.ts - 提取 Workflow/WorkNode/Template 方法
- [x] 2.6 创建 AgentRepository.ts - 提取 AgentExecution CRUD 方法
- [x] 2.7 重构 DatabaseService 为 facade，委托给各 Repository
- [x] 2.8 创建 index.ts 统一导出
- [x] 2.9 验证 TypeScript 编译通过
- [x] 2.10 验证 IPC 层调用正常工作

## 3. P3 - 集中类型定义

- [x] 3.1 创建 `src/main/types/task.ts` - 提取 Task 相关类型
- [x] 3.2 创建 `src/main/types/project.ts` - 提取 Project 相关类型
- [x] 3.3 创建 `src/main/types/workflow.ts` - 提取 Workflow 相关类型
- [x] 3.4 创建 `src/main/types/agent.ts` - 提取 AgentExecution 类型
- [x] 3.5 创建 `src/main/types/index.ts` 统一导出
- [x] 3.6 更新 Repository 和 Service 的类型导入
- [x] 3.7 验证 TypeScript 编译通过

## 4. 清理和验证

- [x] 4.1 删除原 DataBatcher.ts 文件
- [x] 4.2 删除原 AppPaths.ts 文件（如果移动后仍存在）
- [ ] 4.3 运行完整测试套件
- [x] 4.4 更新 docs/src-main-architecture-tasks.md 进度表
