# Project Repositories Specification

## ADDED Requirements

### Requirement: 项目列表管理
应用 SHALL 维护本地项目列表,记录所有已添加的Git仓库。

#### Scenario: 显示项目列表
- **WHEN** 用户打开项目页面
- **THEN** 显示所有已添加项目的列表,包含项目名称、路径、最后访问时间

#### Scenario: 搜索项目
- **WHEN** 用户在搜索框输入关键词
- **THEN** 实时过滤项目列表,显示匹配的项目

#### Scenario: 排序项目
- **WHEN** 用户选择排序方式(按名称、按时间)
- **THEN** 项目列表按选定方式重新排序

### Requirement: 克隆远程仓库
应用 SHALL 支持从远程Git服务克隆仓库到本地。

#### Scenario: 输入仓库URL
- **WHEN** 用户点击"克隆仓库"并输入Git URL
- **THEN** 验证URL格式,显示目标路径选择器

#### Scenario: 克隆进度显示
- **WHEN** 开始克隆仓库
- **THEN** 显示克隆进度条和当前状态(正在克隆、对象数量、速度)

#### Scenario: 克隆完成
- **WHEN** 仓库克隆完成
- **THEN** 自动添加到项目列表并打开项目详情页

#### Scenario: 克隆失败
- **WHEN** 克隆过程中发生错误(网络问题、权限不足)
- **THEN** 显示错误信息并提供重试选项

### Requirement: 创建本地仓库
应用 SHALL 支持创建新的本地Git仓库。

#### Scenario: 创建空仓库
- **WHEN** 用户点击"新建项目"并选择目录
- **THEN** 在指定目录执行git init,创建新仓库并添加到项目列表

#### Scenario: 初始化配置
- **WHEN** 创建新仓库
- **THEN** 提示用户配置项目名称、默认分支名、.gitignore模板

### Requirement: 项目打开方式配置
应用 SHALL 支持配置外部编辑器打开项目。

#### Scenario: 配置VSCode
- **WHEN** 用户在项目设置中选择"VSCode"作为编辑器
- **THEN** 保存VSCode可执行文件路径到项目配置

#### Scenario: 快速打开编辑器
- **WHEN** 用户点击项目详情页的"打开编辑器"图标
- **THEN** 使用配置的编辑器命令打开项目目录

#### Scenario: 编辑器未配置
- **WHEN** 用户点击"打开编辑器"但未配置编辑器
- **THEN** 显示配置向导,引导用户选择编辑器

### Requirement: 项目删除
应用 SHALL 支持从列表中移除项目。

#### Scenario: 仅移除引用
- **WHEN** 用户选择"从列表移除"
- **THEN** 从项目列表删除记录,但保留磁盘上的文件

#### Scenario: 删除项目文件
- **WHEN** 用户选择"删除项目及文件"
- **THEN** 显示确认对话框,确认后删除项目列表记录和磁盘文件
