# Tasks: CLI 输出渲染增强

## 1. 依赖安装

- [x] 1.1 安装 react-virtuoso 依赖
- [x] 1.2 安装 fancy-ansi 依赖

## 2. 主进程 - 数据批处理

- [x] 2.1 实现 DataBatcher 类 (`src/main/services/DataBatcher.ts`)
  - 时间批处理 (16ms 窗口)
  - 大小批处理 (200KB 阈值)
  - UTF-8 StringDecoder 处理
- [x] 2.2 集成 DataBatcher 到 ClaudeCodeService
- [x] 2.3 集成 DataBatcher 到 CLIProcessService

## 3. 主进程 - MsgStore 增强

- [x] 3.1 实现 historyPlusStream() 方法
- [x] 3.2 实现 stdoutLinesStream() 方法
- [x] 3.3 添加行分割处理逻辑

## 4. 前端 - 虚拟化组件

- [x] 4.1 创建 VirtualizedLogList 组件
- [x] 4.2 实现自动滚动到底部功能
- [x] 4.3 实现动态高度支持
- [x] 4.4 集成到 TerminalOutput 组件

## 5. 前端 - ANSI 渲染

- [x] 5.1 创建 AnsiText 组件封装 fancy-ansi (在 VirtualizedLogList 中)
- [x] 5.2 添加 ANSI 颜色 CSS 样式
- [x] 5.3 替换现有的 ANSI 解析逻辑 (virtualized 模式使用 fancy-ansi)

## 6. 集成测试

- [ ] 6.1 测试大量日志渲染性能 (10000+ 条)
- [ ] 6.2 测试批处理延迟
- [ ] 6.3 测试 ANSI 颜色渲染完整性
