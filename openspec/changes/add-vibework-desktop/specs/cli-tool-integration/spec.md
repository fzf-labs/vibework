# CLI Tool Integration Specification

## ADDED Requirements

### Requirement: CLI工具配置
应用 SHALL 支持配置多个CLI AI工具的可执行文件路径和参数。

#### Scenario: 添加CLI工具
- **WHEN** 用户在设置中添加新的CLI工具(如Claude Code)
- **THEN** 提示选择可执行文件路径,保存到全局配置

#### Scenario: 验证工具可用性
- **WHEN** 保存CLI工具配置
- **THEN** 执行版本检查命令,验证工具是否可用

#### Scenario: 配置工具参数
- **WHEN** 用户为CLI工具配置默认参数
- **THEN** 保存参数到配置,启动工具时自动应用

### Requirement: 进程管理
应用 SHALL 管理CLI工具的进程生命周期,包括启动、停止和重启。

#### Scenario: 启动CLI工具
- **WHEN** 用户在任务中启动CLI工具
- **THEN** 创建子进程,设置工作目录为任务的worktree路径

#### Scenario: 停止CLI工具
- **WHEN** 用户点击"停止"按钮
- **THEN** 向进程发送终止信号,等待进程退出

#### Scenario: 进程异常退出
- **WHEN** CLI工具进程意外退出
- **THEN** 显示错误通知,记录退出码和错误信息

### Requirement: 输出流捕获
应用 SHALL 捕获CLI工具的标准输出和标准错误,实时显示在UI中。

#### Scenario: 实时显示输出
- **WHEN** CLI工具产生输出
- **THEN** 实时追加到输出日志面板,自动滚动到最新内容

#### Scenario: 输出日志搜索
- **WHEN** 用户在日志面板搜索关键词
- **THEN** 高亮显示匹配的行

### Requirement: 多会话管理
应用 SHALL 支持同时运行多个CLI工具会话,处理不同任务。

#### Scenario: 创建新会话
- **WHEN** 用户在任务中点击"新建会话"
- **THEN** 创建新的CLI工具实例,显示在会话列表中

#### Scenario: 切换会话
- **WHEN** 用户点击会话标签
- **THEN** 切换到对应会话的输出日志和输入框

#### Scenario: 关闭会话
- **WHEN** 用户关闭会话标签
- **THEN** 停止对应的CLI工具进程,清理会话数据
