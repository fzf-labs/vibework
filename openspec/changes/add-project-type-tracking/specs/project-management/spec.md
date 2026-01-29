## MODIFIED Requirements
### Requirement: Project CRUD Operations
系统 SHALL 提供项目的创建、读取、更新、删除操作，并在创建时确定项目类型。

#### Scenario: Clone remote repository
- **WHEN** 用户提供远程仓库 URL 和目标路径
- **THEN** 系统克隆仓库到指定路径并添加到项目列表
- **AND** 系统将项目类型保存为 `git`

#### Scenario: Create new project
- **WHEN** 用户指定本地路径创建新项目
- **THEN** 系统添加项目到列表且不自动初始化 Git 仓库
- **AND** 系统依据项目根目录是否包含 `.git` 判定项目类型并保存为 `git` 或 `normal`

#### Scenario: List all projects
- **WHEN** 用户请求项目列表
- **THEN** 系统返回所有已添加项目的信息（包含 `project_type`）

#### Scenario: Remove project
- **WHEN** 用户删除项目
- **THEN** 系统从列表移除项目（不删除本地文件）

### Requirement: Project Metadata Storage
系统 SHALL 持久化存储项目元数据（包括 `project_type`）。

#### Scenario: Persist project data
- **WHEN** 项目被添加或修改
- **THEN** 系统将元数据保存到本地数据库（包含 `project_type`）

#### Scenario: Load projects on startup
- **WHEN** 应用启动
- **THEN** 系统从数据库加载所有项目信息（包含 `project_type`）

## ADDED Requirements
### Requirement: Project Path Validation
系统 SHALL 在用户点击/选择项目时校验项目路径并更新类型状态。

#### Scenario: Path missing on selection
- **WHEN** 用户点击项目且项目路径不存在
- **THEN** 系统提示用户路径不存在或已移动

#### Scenario: Update project type on selection
- **WHEN** 用户点击项目且项目路径存在
- **THEN** 系统检测项目根目录是否包含 `.git`
- **AND** 若判定结果与已存储的 `project_type` 不一致，则更新并持久化
