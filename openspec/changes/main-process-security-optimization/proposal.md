## Why

`src/main` 目录存在严重的安全漏洞（Shell 注入、IPC 权限过宽、命令执行入口过多）和资源管理问题（内存泄漏、进程管理不当），这些问题可能导致任意命令执行、本地提权和应用崩溃。代码审查发现 18 个问题，其中 3 个 P0 紧急安全问题需要立即修复。

## What Changes

### 安全修复 (P0)
- **BREAKING**: 所有 Git 命令从 `exec()` 字符串拼接改为 `execFile()` 参数数组，防止 Shell 注入
- **BREAKING**: 启用 `sandbox: true` 和 `contextIsolation: true`，收敛 IPC 权限边界
- **BREAKING**: 所有命令执行入口改为 `execFile/spawn` + args，禁用 `shell: true`
- 添加 IPC 文件操作路径白名单和协议白名单

### 资源管理修复 (P1)
- 修复 `logStreamSubscriptions` 内存泄漏，监听 webContents destroyed 事件自动清理
- 修复 `ClaudeCodeService` 事件监听器泄漏
- 修复 `PreviewService` 进程管理，等待进程退出并添加超时强制杀死
- 修复 `CLIProcessService` 会话清理

### 代码质量改进 (P2)
- 统一 IPC 错误处理格式
- 移除 `as any` 类型转换，使用类型守卫
- 添加 zod 输入验证
- 修复 Pipeline 取消执行不终止进程问题
- 改造日志持久化为异步写入并添加轮转

### 架构优化 (P3)
- 拆分 `index.ts`（1437行）为模块化 IPC 处理器
- 提取硬编码配置到配置模块
- 优化字符串拼接性能
- 修复异步操作处理
- 添加数据库重置备份机制

## Capabilities

### New Capabilities
- `secure-command-execution`: 安全的命令执行封装，使用 execFile/spawn + args 数组，防止命令注入
- `ipc-security`: IPC 安全边界控制，包括路径白名单、协议白名单和权限校验
- `resource-lifecycle`: 资源生命周期管理，包括订阅清理、事件监听器清理、进程管理
- `ipc-response-wrapper`: 统一的 IPC 响应格式和错误处理
- `input-validation`: 基于 zod 的输入验证层

### Modified Capabilities
- `execution-log-storage`: 改为异步写入并添加日志轮转机制

## Impact

### 受影响的文件
| 文件 | 变更类型 |
|------|----------|
| `src/main/index.ts` | 重构拆分、安全加固 |
| `src/main/services/GitService.ts` | 安全修复 |
| `src/main/services/CLIProcessService.ts` | 资源管理修复 |
| `src/main/services/PreviewService.ts` | 进程管理修复 |
| `src/main/services/PipelineService.ts` | 安全修复、取消逻辑修复 |
| `src/main/services/ClaudeCodeService.ts` | 资源管理修复 |
| `src/main/services/MsgStoreService.ts` | 异步改造 |
| `src/main/services/DatabaseService.ts` | 备份机制 |

### 新增目录/文件
- `src/main/ipc/` - IPC 处理器模块
- `src/main/config/` - 配置模块
- `src/main/utils/ipc-response.ts` - 响应包装器
- `src/main/utils/validators.ts` - 输入验证

### 依赖变更
- 新增 `zod` 用于输入验证

### API 变更
- IPC 响应格式统一为 `{ success: boolean, data?: T, error?: string }`
