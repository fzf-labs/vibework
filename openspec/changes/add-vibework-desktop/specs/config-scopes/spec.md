# Config Scopes Specification

## ADDED Requirements

### Requirement: 全局配置管理
应用 SHALL 维护全局级别的配置,适用于所有项目。

#### Scenario: 保存全局配置
- **WHEN** 用户在全局设置中修改配置
- **THEN** 保存到~/.vibework/config.json文件

#### Scenario: 读取全局配置
- **WHEN** 应用启动
- **THEN** 从~/.vibework/config.json加载全局配置

### Requirement: 项目级配置管理
应用 SHALL 支持项目级别的配置,覆盖全局配置。

#### Scenario: 保存项目配置
- **WHEN** 用户在项目设置中修改配置
- **THEN** 保存到项目目录的.vibework/config.json文件

#### Scenario: 配置优先级
- **WHEN** 加载项目配置
- **THEN** 项目配置覆盖全局配置的同名项

### Requirement: MCP服务器配置
应用 SHALL 支持配置MCP服务器,分为全局和项目级别。

#### Scenario: 添加全局MCP服务器
- **WHEN** 用户在全局设置中添加MCP服务器配置
- **THEN** 保存到全局配置,所有项目可用

#### Scenario: 添加项目级MCP服务器
- **WHEN** 用户在项目设置中添加MCP服务器
- **THEN** 保存到项目配置,仅当前项目可用

#### Scenario: MCP配置合并
- **WHEN** 加载项目的MCP配置
- **THEN** 合并全局和项目级MCP服务器列表

### Requirement: Skill配置管理
应用 SHALL 支持配置Skill,分为全局和项目级别。

#### Scenario: 添加全局Skill
- **WHEN** 用户在全局设置中添加Skill配置
- **THEN** 保存到全局配置,所有项目可用

#### Scenario: 添加项目级Skill
- **WHEN** 用户在项目设置中添加Skill
- **THEN** 保存到项目配置,仅当前项目可用

### Requirement: 任务流水线模板管理
应用 SHALL 支持配置任务流水线模板,分为全局和项目级别。

#### Scenario: 创建全局流水线模板
- **WHEN** 用户在全局设置中创建流水线模板
- **THEN** 保存到全局配置,所有项目可用

#### Scenario: 创建项目级流水线模板
- **WHEN** 用户在项目设置中创建流水线模板
- **THEN** 保存到项目配置,仅当前项目可用

#### Scenario: 导出配置
- **WHEN** 用户点击"导出配置"
- **THEN** 将当前配置导出为JSON文件

#### Scenario: 导入配置
- **WHEN** 用户选择配置文件并导入
- **THEN** 合并导入的配置到当前配置
