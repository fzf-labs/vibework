## ADDED Requirements

### Requirement: Changed Files List
系统 SHALL 展示仓库中所有变更文件的列表。

#### Scenario: List changed files
- **WHEN** 用户查看项目变更
- **THEN** 系统展示所有修改、新增、删除的文件

#### Scenario: Show file status
- **WHEN** 文件列表展示
- **THEN** 每个文件显示其状态(M/A/D/?)和暂存状态
