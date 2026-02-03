# src/main 代码问题处理方案

> 审查日期: 2026-02-02
> 审查范围: src/main 目录

## 概述

本文档记录了对 `src/main` 目录代码审查发现的问题及对应的处理方案。问题按优先级分为 P0（紧急）、P1（高）、P2（中）、P3（低）四个等级。

---

## 一、P0 紧急问题（必须立即修复）

### 1.1 Shell 注入漏洞

**文件**: `src/main/services/GitService.ts`
**行号**: 51, 59, 67, 76, 88, 98

**问题描述**:
直接在 shell 命令中拼接用户输入，未进行转义，可能导致任意命令执行。

```typescript
// 当前代码（危险）
await execAsync(`git clone ${remoteUrl} "${targetPath}"`)
await execAsync(`git -C "${path}" status`)
```

**修复方案**:
使用 `child_process.execFile()` 替代 `exec()`，通过参数数组传递参数：

```typescript
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// 修复后
async clone(remoteUrl: string, targetPath: string): Promise<void> {
  await execFileAsync('git', ['clone', remoteUrl, targetPath])
}

async getStatus(path: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', path, 'status'])
  return stdout
}
```

**验收标准**:
- [ ] 所有 git 命令使用 `execFile` 或 `spawn`
- [ ] 无任何字符串拼接构建命令
- [ ] 添加单元测试验证特殊字符处理

---

### 1.2 主进程安全边界过宽（IPC + sandbox 关闭）

**文件**: `src/main/index.ts`  
**行号**: 64-75, 1178-1325

**问题描述**:
- `webPreferences.sandbox = false`，同时暴露了 `fs:*`、`shell:*` 等高权限 IPC。
- 渲染进程一旦被注入或加载不可信内容，可直接读写/删除任意文件、打开任意 URL，等同本地提权。

**修复方案**:
- 启用 `sandbox: true` 和 `contextIsolation: true`。
- IPC 文件操作加路径白名单（仅允许 workspace/用户选择目录），并在主进程做 `realpath + allowlist` 校验。
- `shell:openUrl` 仅允许 `http/https` 且可选域名白名单，禁止 `file://` 等协议。
- 对删除/覆盖类操作增加用户确认与审计日志。

**验收标准**:
- [ ] sandbox + contextIsolation 均启用
- [ ] fs/shell IPC 具备路径/协议白名单
- [ ] 渲染进程无法直接操作任意路径

---

### 1.3 命令执行入口过多（shell: true + 拼接）

**文件**:  
`src/main/services/PipelineService.ts`  
`src/main/services/PreviewService.ts`  
`src/main/services/CLIProcessService.ts`  
`src/main/services/cli/ProcessCliSession.ts`  
`src/main/services/EditorService.ts`

**问题描述**:
多处使用 `exec` 拼接字符串或 `spawn` + `shell: true` 执行命令。若参数来自 IPC/配置/用户输入，存在命令注入与执行面过广的风险。

**修复方案**:
- 使用 `execFile` 或 `spawn` + args 数组，避免字符串拼接。
- 默认 `shell: false`，除非有强需求。
- 对可执行命令做白名单控制，并对参数进行严格校验。

**验收标准**:
- [ ] 所有命令执行改为 `execFile/spawn` + args
- [ ] `shell: true` 仅在受控场景使用
- [ ] 高风险 IPC 增加白名单/校验

---

## 二、P1 高优先级问题

### 2.1 内存泄漏 - logStreamSubscriptions

**文件**: `src/main/index.ts`
**行号**: 727-757

**问题描述**:
`logStreamSubscriptions` Map 在渲染进程销毁时未清理订阅。

**修复方案**:
监听 webContents 的 destroyed 事件进行清理：

```typescript
ipcMain.handle('logStream:subscribe', (event, sessionId: string) => {
  const webContents = event.sender
  const key = `${webContents.id}-${sessionId}`

  // 清理旧订阅
  const oldUnsubscribe = logStreamSubscriptions.get(key)
  if (oldUnsubscribe) {
    oldUnsubscribe()
    logStreamSubscriptions.delete(key)
  }

  const unsubscribe = cliSessionService.subscribeToSession(sessionId, (msg) => {
    if (!webContents.isDestroyed()) {
      webContents.send('logStream:message', sessionId, msg)
    }
  })

  if (unsubscribe) {
    logStreamSubscriptions.set(key, unsubscribe)

    // 监听销毁事件自动清理
    webContents.once('destroyed', () => {
      const sub = logStreamSubscriptions.get(key)
      if (sub) {
        sub()
        logStreamSubscriptions.delete(key)
      }
    })
  }
})
```

**验收标准**:
- [ ] webContents 销毁时自动清理订阅
- [ ] 无内存泄漏

---

### 2.2 事件监听器未清理

**文件**: `src/main/services/ClaudeCodeService.ts`

**问题描述**:
子进程事件监听器在会话关闭时未移除，导致内存泄漏。

**修复方案**:
在进程关闭时移除所有监听器：

```typescript
private cleanupSession(sessionId: string): void {
  const session = this.sessions.get(sessionId)
  if (session?.process) {
    session.process.stdout?.removeAllListeners()
    session.process.stderr?.removeAllListeners()
    session.process.removeAllListeners()
  }
  this.sessions.delete(sessionId)
}
```

**验收标准**:
- [ ] 会话关闭时移除所有事件监听器
- [ ] 无内存泄漏

---

### 2.3 PreviewService 进程管理问题

**文件**: `src/main/services/PreviewService.ts`
**行号**: 81-92

**问题描述**:
`stopPreview()` 只调用 `kill()` 但不等待进程退出，可能导致僵尸进程。

**修复方案**:

```typescript
async stopPreview(instanceId: string): Promise<void> {
  const instance = this.instances.get(instanceId)
  if (!instance) {
    throw new Error(`Preview instance ${instanceId} not found`)
  }

  const process = this.processes.get(instanceId)
  if (process) {
    instance.status = 'stopping'

    await new Promise<void>((resolve) => {
      process.once('exit', () => {
        this.processes.delete(instanceId)
        this.instances.delete(instanceId)
        resolve()
      })
      process.kill('SIGTERM')

      // 超时强制杀死
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL')
        }
      }, 5000)
    })
  }
}
```

**验收标准**:
- [ ] 等待进程真正退出
- [ ] 添加超时强制杀死机制
- [ ] 无僵尸进程

---

### 2.4 CLIProcessService 会话未清理

**文件**: `src/main/services/CLIProcessService.ts`  
**行号**: 65-74

**问题描述**:
子进程 `close` 时没有从 `sessions` Map 中移除，导致会话与输出缓存长期保留、状态过期，形成内存泄漏。

**修复方案**:
在 `close` 回调中移除 session（如需保留历史，转存到只读结构）：

```typescript
childProcess.on('close', (code) => {
  session.stdoutBatcher.destroy()
  session.stderrBatcher.destroy()
  session.status = code === 0 ? 'stopped' : 'error'
  this.emit('close', { sessionId, code })
  this.sessions.delete(sessionId)
})
```

**验收标准**:
- [ ] 进程退出后会话自动清理
- [ ] getAllSessions 不包含已结束会话

---

## 三、P2 中优先级问题

### 3.1 类型不安全 (as any)

**文件**: `src/main/index.ts`
**行号**: 1394

**问题描述**:
使用 `as any` 绕过 TypeScript 类型检查。

**修复方案**:
使用类型守卫验证：

```typescript
import { TaskStatus } from './types'

function isValidTaskStatus(status: string): status is TaskStatus {
  return ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)
}

ipcMain.handle('task:updateStatus', (_, id: string, status: string) => {
  if (!isValidTaskStatus(status)) {
    throw new Error(`Invalid task status: ${status}`)
  }
  return taskService.updateTaskStatus(id, status)
})
```

**验收标准**:
- [ ] 移除所有 `as any` 类型转换
- [ ] 使用类型守卫进行运行时验证

---

### 3.2 错误处理不一致

**文件**: `src/main/index.ts`

**问题描述**:
部分 IPC 处理器返回 `{ success, error }`，部分直接 throw。

**修复方案**:
创建统一的响应包装器：

```typescript
// src/main/utils/ipc-response.ts
interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: string
}

function wrapHandler<T>(
  handler: (...args: any[]) => T | Promise<T>
): (...args: any[]) => Promise<IpcResponse<T>> {
  return async (...args) => {
    try {
      const data = await handler(...args)
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

// 使用
ipcMain.handle('db:createTask', wrapHandler((_, input) => {
  return databaseService.createTask(input)
}))
```

**验收标准**:
- [ ] 所有 IPC 处理器使用统一响应格式
- [ ] 渲染进程统一处理响应

---

### 3.3 主文件过长

**文件**: `src/main/index.ts`
**行数**: 1437 行

**问题描述**:
所有 IPC 处理器集中在一个文件，难以维护。

**修复方案**:
按功能模块拆分：

```
src/main/
├── index.ts              # 应用入口，窗口管理
├── ipc/
│   ├── index.ts          # IPC 注册入口
│   ├── project.ipc.ts    # 项目相关 IPC
│   ├── task.ipc.ts       # 任务相关 IPC
│   ├── database.ipc.ts   # 数据库相关 IPC
│   ├── git.ipc.ts        # Git 相关 IPC
│   └── preview.ipc.ts    # 预览相关 IPC
```

**验收标准**:
- [ ] index.ts 行数 < 300
- [ ] IPC 处理器按功能模块分离

---

### 3.4 缺少输入验证

**文件**: `TaskService.ts`, `ProjectService.ts`

**修复方案**:
添加验证层：

```typescript
// src/main/utils/validators.ts
import { z } from 'zod'

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  projectId: z.string().uuid(),
  status: z.enum(['pending', 'in_progress', 'completed'])
})

// 在服务中使用
createTask(input: unknown) {
  const validated = CreateTaskSchema.parse(input)
  // ...
}
```

**验收标准**:
- [ ] 所有用户输入经过验证
- [ ] 使用 zod 或类似库进行 schema 验证

---

### 3.5 Pipeline 取消执行不终止进程

**文件**: `src/main/services/PipelineService.ts`  
**行号**: 78-105, 176-206, 254-262

**问题描述**:
`cancelExecution()` 仅更新状态，不会终止正在运行的命令，导致 UI 状态与真实执行不一致。

**修复方案**:
保存正在运行的子进程或 AbortController，在取消时发送 SIGTERM/SIGKILL：

```typescript
interface StageExecution {
  // ...
  process?: ChildProcess
}

// executeCommand 中保存 process
const child = spawn(command, args, { cwd, shell: false })
stageExecution.process = child

cancelExecution(executionId: string): void {
  const execution = this.executions.get(executionId)
  if (!execution) throw new Error('Execution not found')
  execution.status = 'cancelled'
  execution.completedAt = new Date()
  for (const stage of execution.stageExecutions) {
    stage.process?.kill('SIGTERM')
  }
  this.emit('execution:cancelled', execution)
}
```

**验收标准**:
- [ ] 取消时终止正在运行的进程
- [ ] 取消后的执行不会继续输出

---

### 3.6 日志持久化同步写 + 无轮转

**文件**: `src/main/services/MsgStoreService.ts`  
**行号**: 93-96

**问题描述**:
日志使用 `appendFileSync` 写入主线程，且日志文件无轮转/上限，长会话会导致 UI 卡顿与磁盘膨胀。

**修复方案**:
- 改为异步写入（批量队列/节流）。
- 增加文件大小限制与轮转策略（按大小或日期）。

**验收标准**:
- [ ] 日志写入不阻塞主线程
- [ ] 单个日志文件有上限并可轮转

---

## 四、P3 低优先级问题

### 4.1 硬编码配置值

**文件**: `ClaudeCodeService.ts`, `DataBatcher.ts`

**修复方案**:
提取到配置文件：

```typescript
// src/main/config/index.ts
export const config = {
  claude: {
    executablePath: process.env.CLAUDE_PATH || 'claude',
    defaultModel: process.env.CLAUDE_MODEL || 'sonnet'
  },
  batcher: {
    flushIntervalMs: 16,
    maxBatchBytes: 200 * 1024
  }
}
```

---

### 4.2 缺少超时控制

**文件**: `GitService.ts`

**修复方案**:

```typescript
const execFileAsync = promisify(execFile)

async execWithTimeout(
  cmd: string,
  args: string[],
  timeoutMs = 30000
): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const { stdout } = await execFileAsync(cmd, args, {
      signal: controller.signal
    })
    return stdout
  } finally {
    clearTimeout(timeout)
  }
}
```

---

### 4.3 字符串拼接性能问题

**文件**: `DataBatcher.ts:38`

**问题描述**:
使用 `+=` 进行字符串拼接，时间复杂度 O(n²)。

**修复方案**:

```typescript
class DataBatcher {
  private chunks: string[] = []

  write(data: string): void {
    this.chunks.push(data)
  }

  flush(): string {
    const result = this.chunks.join('')
    this.chunks = []
    return result
  }
}
```

---

### 4.4 异步操作未正确处理

**文件**: `EditorService.ts:26`

**问题描述**:
构造函数中调用异步方法但未等待完成。

**修复方案**:

```typescript
class EditorService {
  private initPromise: Promise<void>

  constructor() {
    this.initPromise = this.detectEditors()
  }

  async ensureInitialized(): Promise<void> {
    await this.initPromise
  }
}
```

---

### 4.5 Legacy 数据库重置存在数据丢失风险

**文件**: `src/main/services/DatabaseService.ts`  
**行号**: 181-202

**问题描述**:
检测到旧表结构就直接删除数据库文件及 WAL/SHM，可能导致历史数据不可恢复。

**修复方案**:
- 先备份旧数据库（改名/迁移）再初始化新库。
- 或者添加迁移脚本与用户确认流程。

**验收标准**:
- [ ] 旧数据库不会被直接删除
- [ ] 有可追溯的备份或迁移机制

---

## 五、问题统计与执行计划

### 问题统计

| 优先级 | 数量 | 说明 |
|--------|------|------|
| P0 紧急 | 3 | 安全漏洞（Shell注入、IPC权限、命令执行） |
| P1 高 | 4 | 内存泄漏、资源管理 |
| P2 中 | 6 | 代码质量、可维护性 |
| P3 低 | 5 | 性能优化、代码规范 |

### 建议执行顺序

**第一阶段 - 安全与稳定性**
1. 修复 Shell 注入漏洞 (1.1)
2. 收敛 IPC 权限边界 (1.2)
3. 命令执行入口收敛 (1.3)

**第二阶段 - 内存与资源**
4. 修复 logStreamSubscriptions 内存泄漏 (2.1)
5. 修复事件监听器泄漏 (2.2)
6. 修复进程管理问题 (2.3)
7. 修复 CLIProcessService 会话清理 (2.4)

**第三阶段 - 代码质量**
8. 统一错误处理 (3.2)
9. 添加类型守卫 (3.1)
10. 添加输入验证 (3.4)
11. 修复 Pipeline 取消执行 (3.5)
12. 改造日志持久化与轮转 (3.6)

**第四阶段 - 架构优化**
13. 拆分主文件 (3.3)
14. 提取配置 (4.1)
15. 性能优化 (4.3, 4.4)
16. 处理 legacy 数据库重置风险 (4.5)

---

## 六、附录

### 相关文件清单

| 文件 | 问题数 | 主要问题 |
|------|--------|----------|
| `index.ts` | 5 | 过长、内存泄漏、类型不安全、IPC 权限过宽、错误处理不一致 |
| `GitService.ts` | 2 | Shell 注入、缺少超时 |
| `CLIProcessService.ts` | 2 | 会话未清理、命令执行入口 |
| `ProcessCliSession.ts` | 1 | 命令执行入口 |
| `PipelineService.ts` | 2 | 命令执行入口、取消不终止 |
| `PreviewService.ts` | 2 | 命令执行入口、进程管理 |
| `EditorService.ts` | 2 | 异步处理、命令执行入口 |
| `MsgStoreService.ts` | 1 | 同步写入、无轮转 |
| `DatabaseService.ts` | 1 | 重置风险 |
| `ClaudeCodeService.ts` | 1 | 事件监听器泄漏 |
| `DataBatcher.ts` | 1 | 字符串拼接性能 |

---

### 目录结构分析

**当前结构**:

```
src/main/
├── index.ts              # 主入口（1437行，过长）
├── storage.ts
├── types.ts
├── types/
│   └── log.ts
├── utils/
│   └── ids.ts
└── services/
    ├── cli/
    │   ├── adapters/
    │   │   ├── ClaudeCodeAdapter.ts
    │   │   ├── GeminiCliAdapter.ts
    │   │   └── ...
    │   ├── CliSessionService.ts
    │   ├── ProcessCliSession.ts
    │   └── types.ts
    ├── normalizers/
    │   ├── ClaudeCodeNormalizer.ts
    │   └── ...
    └── [其他服务文件...]
```

**存在的问题**:

| 问题 | 说明 |
|------|------|
| index.ts 过大 | 1437行，包含所有 IPC 处理器，难以维护 |
| 类型定义分散 | `types.ts` 为空文件，真实类型在 `types/log.ts` |
| 服务职责不清 | `CLIProcessService` 与 `cli/ProcessCliSession` 功能重叠 |
| 缺少分层 | 服务层扁平，无 domain/infra 分离 |
| 缺少配置模块 | 硬编码配置散落在各服务中 |

**建议的目录结构**:

```
src/main/
├── index.ts              # 仅应用启动和窗口管理（<300行）
├── ipc/                  # IPC 处理器（新增）
│   ├── index.ts          # 统一注册入口
│   ├── project.ipc.ts
│   ├── task.ipc.ts
│   ├── database.ipc.ts
│   ├── git.ipc.ts
│   ├── preview.ipc.ts
│   └── fs.ipc.ts
├── types/                # 统一类型定义
│   ├── index.ts
│   ├── log.ts
│   └── ipc.ts
├── utils/
│   ├── ids.ts
│   └── ipc-response.ts   # IPC 响应包装器
├── config/               # 配置模块（新增）
│   └── index.ts
└── services/
    ├── cli/              # CLI 相关
    ├── normalizers/      # 规范化器
    └── ...
```

**重构步骤**:

1. 创建 `ipc/` 目录，按功能拆分 IPC 处理器
2. 统一 `types/` 目录，删除空的 `types.ts` 并集中类型定义
3. 创建 `config/` 目录，提取硬编码配置
4. 清理 `CLIProcessService`，明确与 `cli/` 模块的边界
