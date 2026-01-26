# Preview Runner Specification

## ADDED Requirements

### Requirement: 预览脚本配置
应用 SHALL 支持为项目配置预览脚本,定义如何启动预览。

#### Scenario: 配置前端预览脚本
- **WHEN** 用户在项目设置中添加预览脚本(如"npm run dev")
- **THEN** 保存脚本命令和端口号到项目配置

#### Scenario: 配置后端预览脚本
- **WHEN** 用户配置后端项目的启动命令
- **THEN** 保存脚本命令,标记为"后端"类型

### Requirement: 脚本执行
应用 SHALL 执行预览脚本并管理其生命周期。

#### Scenario: 启动预览
- **WHEN** 用户点击"启动预览"
- **THEN** 在任务的worktree目录执行预览脚本,显示输出日志

#### Scenario: 停止预览
- **WHEN** 用户点击"停止预览"
- **THEN** 终止预览进程,清理资源

#### Scenario: 重启预览
- **WHEN** 用户点击"重启预览"
- **THEN** 先停止当前预览进程,然后重新启动

### Requirement: 前端预览展示
应用 SHALL 为前端项目提供内嵌浏览器预览。

#### Scenario: 自动打开预览窗口
- **WHEN** 前端预览脚本启动成功
- **THEN** 自动打开内嵌浏览器,加载配置的预览URL

#### Scenario: 刷新预览
- **WHEN** 用户点击"刷新"按钮
- **THEN** 重新加载预览页面

### Requirement: 后端预览日志
应用 SHALL 为后端项目显示运行日志。

#### Scenario: 显示后端日志
- **WHEN** 后端预览脚本运行
- **THEN** 实时显示stdout和stderr输出

#### Scenario: 日志过滤
- **WHEN** 用户选择日志级别过滤(如只显示错误)
- **THEN** 只显示匹配级别的日志行
