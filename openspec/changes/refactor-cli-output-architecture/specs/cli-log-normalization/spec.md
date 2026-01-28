## ADDED Requirements

### Requirement: 日志标准化服务

系统 SHALL 提供 LogNormalizerService 用于将不同 CLI 工具的输出转换为统一的 NormalizedEntry 格式。

#### Scenario: 适配器注册
- **WHEN** 系统启动时
- **THEN** 注册所有支持的 CLI 工具适配器
- **AND** 每个适配器关联到对应的 toolId

#### Scenario: JSON 输出解析
- **WHEN** CLI 输出包含有效的 JSON 格式数据
- **THEN** 使用对应工具的适配器解析为 NormalizedEntry
- **AND** 保留原始内容和结构化元数据

#### Scenario: 非 JSON 输出降级处理
- **WHEN** CLI 输出不是有效的 JSON 格式
- **THEN** 将输出作为 system_message 类型的 NormalizedEntry
- **AND** 保留原始文本内容

### Requirement: Claude Code 适配器

系统 SHALL 提供 Claude Code 专用适配器，解析其 stream-json 格式输出。

#### Scenario: 解析工具调用
- **WHEN** 收到 type 为 tool_use 的 JSON 消息
- **THEN** 解析为 tool_use 类型的 NormalizedEntry
- **AND** 提取 toolName、toolInput 等元数据

#### Scenario: 解析工具结果
- **WHEN** 收到 type 为 tool_result 的 JSON 消息
- **THEN** 解析为 tool_result 类型的 NormalizedEntry
- **AND** 提取 output、exitCode、isError 等信息

#### Scenario: 解析助手消息
- **WHEN** 收到 type 为 assistant 的 JSON 消息
- **THEN** 解析为 assistant_message 类型的 NormalizedEntry
- **AND** 提取消息文本内容
