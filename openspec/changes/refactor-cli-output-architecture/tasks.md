# Tasks: CLI 输出架构改造

## 1. 基础设施 - 主进程服务

- [x] 1.1 定义 LogMsg 和 NormalizedEntry 类型 (`src/main/types/log.ts`)
- [x] 1.2 实现 MsgStoreService 消息存储服务 (`src/main/services/MsgStoreService.ts`)
  - 环形缓冲区实现
  - EventEmitter 广播机制
  - 容量限制和自动淘汰
- [x] 1.3 实现 LogNormalizerService 框架 (`src/main/services/LogNormalizerService.ts`)
  - 适配器注册机制
  - 通用解析接口

## 2. CLI 工具适配器

- [x] 2.1 实现 Claude Code 适配器 (`src/main/services/normalizers/ClaudeCodeNormalizer.ts`)
  - 解析 stream-json 格式输出
  - 处理 tool_use、tool_result、message 等类型
- [x] 2.2 实现 Codex 适配器 (`src/main/services/normalizers/CodexNormalizer.ts`)
- [x] 2.3 实现 Gemini CLI 适配器 (`src/main/services/normalizers/GeminiNormalizer.ts`)

## 3. 服务集成

- [x] 3.1 改造 ClaudeCodeService 集成 MsgStore
  - 替换现有的 output 数组为 MsgStore
  - 添加日志标准化处理
- [ ] 3.2 改造 CLIProcessService 支持通用日志流
- [x] 3.3 注册 IPC handlers (`src/main/index.ts`)
  - logStream:subscribe
  - logStream:unsubscribe
  - logStream:getHistory

## 4. Preload 层

- [x] 4.1 扩展 preload API (`src/preload/index.ts`)
  - 添加 logStream 模块
  - 暴露订阅/取消订阅方法

## 5. 前端 - Hooks 和组件

- [x] 5.1 实现 useLogStream Hook (`src/renderer/src/hooks/useLogStream.ts`)
  - IPC 订阅管理
  - 状态更新和清理
- [x] 5.2 改造 TerminalOutput 组件
  - 支持增量更新
  - 集成 ANSI 颜色渲染 (内置解析器)
- [x] 5.3 新增 NormalizedLogView 组件
  - 结构化日志展示
  - 工具调用、文件操作等分类显示

## 6. 页面集成

- [x] 6.1 更新 TaskDetail 页面集成新的日志流
- [x] 6.2 添加日志视图切换（原始/结构化）

## 7. 测试和文档

- [ ] 7.1 编写 MsgStoreService 单元测试
- [ ] 7.2 编写 LogNormalizerService 单元测试
- [ ] 7.3 编写各适配器的解析测试
- [ ] 7.4 更新 API 文档
