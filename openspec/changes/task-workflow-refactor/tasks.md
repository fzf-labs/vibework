## 1. 数据库表结构迁移

- [x] 1.1 创建 global_workflow_templates 表，替代 global_task_pipeline_templates
- [x] 1.2 创建 global_work_node_templates 表，替代 global_task_pipeline_template_stages
- [x] 1.3 创建 project_workflow_templates 表，替代 projects_task_pipeline_templates
- [x] 1.4 创建 project_work_node_templates 表，替代 projects_task_pipeline_template_stages
- [x] 1.5 创建 workflows 表（工作流实例）
- [x] 1.6 创建 work_nodes 表（工作节点实例）
- [x] 1.7 创建 agent_executions 表（Agent 执行记录）
- [x] 1.8 编写数据迁移脚本，将旧表数据迁移到新表
- [x] 1.9 更新 tasks 表，移除 pipeline_template_id，添加 workflow_id

## 2. TypeScript 类型定义重构

- [x] 2.1 在 src/main/services/DatabaseService.ts 中定义 WorkflowTemplate 接口
- [x] 2.2 在 src/main/services/DatabaseService.ts 中定义 WorkNodeTemplate 接口
- [x] 2.3 在 src/main/services/DatabaseService.ts 中定义 Workflow 接口
- [x] 2.4 在 src/main/services/DatabaseService.ts 中定义 WorkNode 接口
- [x] 2.5 在 src/main/services/DatabaseService.ts 中定义 AgentExecution 接口
- [x] 2.6 更新 src/renderer/src/data/types.ts 中的 Task 类型，分离状态定义
- [x] 2.7 移除 TaskExecutionStatus 和 TaskPipelineStatus 的混合定义

## 3. 数据库服务层重构 (DatabaseService)

- [x] 3.1 实现 WorkflowTemplate CRUD 方法（全局）
- [x] 3.2 实现 WorkflowTemplate CRUD 方法（项目级）
- [x] 3.3 实现 WorkNodeTemplate CRUD 方法
- [x] 3.4 实现从全局模板复制到项目的方法
- [x] 3.5 实现 Workflow 实例创建和查询方法
- [x] 3.6 实现 WorkNode 实例创建和状态更新方法
- [x] 3.7 实现 AgentExecution 记录创建和更新方法
- [x] 3.8 移除旧的 PipelineTemplate 相关方法

## 4. 渲染进程数据适配层更新

- [x] 4.1 更新 src/renderer/src/data/adapter.ts，添加 WorkflowTemplate API
- [x] 4.2 更新 src/renderer/src/data/adapter.ts，添加 Workflow 实例 API
- [x] 4.3 更新 src/renderer/src/data/adapter.ts，添加 AgentExecution API
- [x] 4.4 移除 adapter.ts 中的 PipelineTemplate 相关方法
- [x] 4.5 更新 updateTaskFromMessage 方法以适配新状态模型

## 5. IPC 接口更新

- [x] 5.1 在 main/index.ts 中注册 WorkflowTemplate IPC handlers
- [x] 5.2 在 main/index.ts 中注册 Workflow 实例 IPC handlers
- [x] 5.3 在 main/index.ts 中注册 AgentExecution IPC handlers
- [x] 5.4 更新 preload 脚本暴露新的 API 方法
- [x] 5.5 移除旧的 PipelineTemplate IPC handlers

## 6. UI 组件重构

- [x] 6.1 重命名 PipelineTemplatesSettings.tsx 为 WorkflowTemplatesSettings.tsx
- [x] 6.2 重命名 PipelineTemplateDialog.tsx 为 WorkflowTemplateDialog.tsx
- [x] 6.3 更新 WorkflowTemplatesSettings 组件使用新的 API
- [x] 6.4 更新 WorkflowTemplateDialog 组件使用新的数据结构
- [x] 6.5 更新 SettingsModal 中的 tab 引用
- [x] 6.6 更新任务详情页展示工作流和工作节点状态（保持向后兼容，Pipeline 逻辑暂时保留）

## 7. 国际化更新

- [x] 7.1 更新 src/renderer/src/config/locale/messages/zh/task.ts 翻译（已有完整翻译，保持向后兼容）
- [x] 7.2 更新 src/renderer/src/config/locale/messages/en/task.ts 翻译（已有完整翻译，保持向后兼容）
- [x] 7.3 更新 settings.ts 中的流水线相关翻译 key（已有完整翻译，保持向后兼容）

## 8. 清理和验证

- [x] 8.1 删除旧的 pipeline_templates 相关表（可选，保留备份）- 保留旧表以支持向后兼容
- [x] 8.2 运行类型检查确保无编译错误
- [ ] 8.3 测试全局工作流模板 CRUD 功能
- [ ] 8.4 测试项目工作流模板 CRUD 功能
- [ ] 8.5 测试从全局模板复制到项目功能
- [ ] 8.6 测试任务执行时工作流实例化功能
