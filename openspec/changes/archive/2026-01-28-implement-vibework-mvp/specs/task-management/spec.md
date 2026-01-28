## ADDED Requirements

### Requirement: Task CRUD Operations
系统 SHALL 提供任务的创建、读取、更新、删除操作。

#### Scenario: Create task
- **WHEN** 用户创建新任务并指定项目和描述
- **THEN** 系统创建任务记录并分配唯一 ID

#### Scenario: List tasks
- **WHEN** 用户请求任务列表
- **THEN** 系统返回指定项目的所有任务

#### Scenario: Update task status
- **WHEN** 用户更新任务状态
- **THEN** 系统保存新状态并触发相关操作
