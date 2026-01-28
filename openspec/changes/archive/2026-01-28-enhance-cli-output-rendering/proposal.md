# Change: CLI 输出渲染增强

## Why

当前 VibeWork 的 CLI 输出渲染存在以下性能和体验问题：

1. **渲染性能瓶颈**：大量日志输出时，React 重新渲染整个列表导致 UI 卡顿
2. **IPC 消息频繁**：每条输出都触发一次 IPC 事件，高频输出时造成消息积压
3. **缺乏行分割处理**：stdout 数据块未按行分割，影响 JSON 解析的准确性
4. **ANSI 渲染不完整**：内置解析器缺少完整的颜色样式支持

参考 vibe-kanban 项目的实现，需要引入虚拟化列表、消息批处理和行分割流等优化。

## What Changes

### 主进程改造
- **新增 DataBatcher 数据批处理器**：合并短时间内的多条消息，减少 IPC 频率
- **增强 MsgStoreService**：添加 `historyPlusStream()` 和 `stdoutLinesStream()` 方法
- **新增行分割处理**：确保 JSON 解析按完整行进行

### 渲染进程改造
- **引入 react-virtuoso**：实现虚拟化列表渲染，支持大量日志高效显示
- **新增 VirtualizedLogList 组件**：替代现有的简单列表渲染
- **引入 fancy-ansi**：完整的 ANSI 颜色码渲染支持
- **新增 ANSI 颜色 CSS 样式**：标准化的终端颜色主题

### 性能优化
- **批处理阈值**：16ms 时间窗口或 200KB 数据量
- **虚拟化窗口**：只渲染可视区域的日志条目
- **自动滚动优化**：平滑滚动到底部

## Impact

- **Affected specs**:
  - `cli-output-rendering` (新增)
- **Affected code**:
  - `src/main/services/MsgStoreService.ts` - 增强流处理方法
  - `src/main/services/DataBatcher.ts` - 新增批处理器
  - `src/renderer/src/components/cli/VirtualizedLogList.tsx` - 新增虚拟化组件
  - `src/renderer/src/components/cli/TerminalOutput.tsx` - 集成虚拟化
  - `src/renderer/src/styles/ansi-colors.css` - 新增 ANSI 样式
  - `package.json` - 新增依赖 react-virtuoso, fancy-ansi
