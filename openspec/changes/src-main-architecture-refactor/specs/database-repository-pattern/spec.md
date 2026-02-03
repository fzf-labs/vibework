## ADDED Requirements

### Requirement: Repository 模块独立性

每个 Repository 模块 SHALL 只负责单一领域的数据操作，不得包含其他领域的业务逻辑。

#### Scenario: TaskRepository 只处理 Task 数据
- **WHEN** 调用 TaskRepository 的任何方法
- **THEN** 只操作 tasks 表，不直接操作其他表

#### Scenario: Repository 间无直接依赖
- **WHEN** 一个 Repository 需要另一个领域的数据
- **THEN** 通过 DatabaseService facade 协调，不直接调用其他 Repository

### Requirement: DatabaseService 作为 Facade

DatabaseService SHALL 作为 facade 层，对外提供统一的数据访问接口，内部委托给各 Repository。

#### Scenario: IPC 层调用保持不变
- **WHEN** IPC 层调用 DatabaseService 的方法
- **THEN** 方法签名和返回值与重构前完全一致

#### Scenario: Facade 委托到 Repository
- **WHEN** DatabaseService 收到 createTask 调用
- **THEN** 委托给 TaskRepository.create() 处理

### Requirement: DatabaseConnection 管理连接生命周期

DatabaseConnection SHALL 负责数据库连接的创建、表初始化和关闭。

#### Scenario: 应用启动时初始化
- **WHEN** 应用启动
- **THEN** DatabaseConnection 创建数据库连接并初始化所有表

#### Scenario: 连接共享
- **WHEN** 多个 Repository 需要数据库连接
- **THEN** 使用同一个 DatabaseConnection 实例

### Requirement: 工具类位置正确

工具类 SHALL 放置在符合其职责的目录中。

#### Scenario: DataBatcher 在 utils 目录
- **WHEN** 需要使用数据批处理功能
- **THEN** 从 `src/main/utils/data-batcher` 导入

#### Scenario: AppPaths 在 app 目录
- **WHEN** 需要获取应用路径
- **THEN** 从 `src/main/app/AppPaths` 导入

### Requirement: 类型定义集中管理

领域类型定义 SHALL 集中在 `src/main/types/` 目录。

#### Scenario: Task 类型从 types 导入
- **WHEN** 需要使用 Task 类型
- **THEN** 从 `src/main/types/task` 导入

#### Scenario: 类型文件按领域组织
- **WHEN** 查找 Workflow 相关类型
- **THEN** 在 `src/main/types/workflow.ts` 中找到
