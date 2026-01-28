## ADDED Requirements

### Requirement: Project Configuration
系统 SHALL 支持项目级配置的读写操作。

#### Scenario: Read project config
- **WHEN** 用户打开项目
- **THEN** 系统从 .vibework/config.json 加载项目配置

#### Scenario: Merge configurations
- **WHEN** 项目配置与全局配置同时存在
- **THEN** 项目配置覆盖全局配置的对应字段
