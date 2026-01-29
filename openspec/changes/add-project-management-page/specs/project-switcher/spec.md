## ADDED Requirements
### Requirement: 项目管理入口
项目切换器区域 MUST 提供进入项目管理页面的入口按钮。

#### Scenario: 打开项目管理页面
- **WHEN** 用户点击项目切换器右侧的管理/设置按钮
- **THEN** 系统应导航到 `/projects` 页面

### Requirement: 项目切换器仅用于切换
项目切换器 MUST 仅提供项目选择功能，不包含项目的增删改查操作。

#### Scenario: 项目列表仅支持选择
- **WHEN** 用户展开项目列表
- **THEN** 每一项仅提供选择当前项目的操作
- **AND** 列表中不应出现删除、打开文件夹或编辑项目的动作

## REMOVED Requirements
### Requirement: 创建新项目
**Reason**: 创建项目入口迁移到项目管理页面统一处理。
**Migration**: 用户需通过 `/projects` 页面完成新建项目。
