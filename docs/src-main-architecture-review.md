# src/main 架构问题分析报告

> 审查日期: 2026-02-03

## 概述

本文档记录了对 `src/main` 目录架构设计的全面审查结果，包括发现的问题、风险等级评估和改进建议。

**整体评分: 7.5/10**

---

## 目录结构

```
src/main/
├── index.ts                    # 应用入口，Electron 主进程初始化
├── types.ts                    # 类型定义（当前为空）
├── config/                     # 配置管理
├── types/                      # 日志相关类型
├── utils/                      # 工具函数库
├── services/                   # 核心业务服务层（31个服务）
│   ├── cli/                    # CLI 会话管理
│   │   └── adapters/           # CLI 适配器
│   └── normalizers/            # 日志标准化适配器
├── ipc/                        # IPC 通信层（14个模块）
└── db/                         # 数据库相关
```

---

## 问题清单

### 高风险问题

#### 1. 数据库删除风险

**位置:** `src/main/services/DatabaseService.ts:181-203`

**问题描述:**
`resetLegacyDatabase` 方法在检测到旧表或探测失败时，会直接删除数据库文件，无备份、无用户确认。

**代码示例:**
```typescript
private resetLegacyDatabase(dbPath: string): void {
  // ... 探测逻辑
  if (!shouldReset) return

  rmSync(dbPath, { force: true })      // 直接删除
  rmSync(walPath, { force: true })
  rmSync(shmPath, { force: true })
}
```

**风险:**
- 用户数据永久丢失
- 探测失败（如权限问题）会误删正常数据库
- 无法回滚

**建议:**
- 引入显式迁移流程
- 删除前自动备份
- 添加用户确认对话框
- 记录操作日志

---

#### 2. CLI 输出内存无限累积

**位置:** `src/main/services/CLIProcessService.ts:9-50`

**问题描述:**
`Session` 接口中的 `output: string[]` 数组没有大小限制，长时间运行的 CLI 会话会导致内存持续增长。

**代码示例:**
```typescript
interface Session {
  id: string
  process: ChildProcess
  output: string[]  // 无大小限制
  status: 'running' | 'stopped' | 'error'
  // ...
}

// 持续累积
session.output.push(data)
```

**风险:**
- 内存泄漏
- 长时间运行后应用崩溃
- 系统资源耗尽

**建议:**
- 实现环形缓冲区（Ring Buffer）
- 设置最大条目数或最大字节数
- 超出限制时落盘存储
- 提供流式读取接口

---

#### 3. Pipeline 输出同样存在累积问题

**位置:** `src/main/services/PipelineService.ts:22-31`

**问题描述:**
`StageExecution` 中的 `output` 字段同样会累积命令输出。

**代码示例:**
```typescript
interface StageExecution {
  // ...
  output?: string   // 累积所有输出
  error?: string
  // ...
}
```

**建议:**
- 与 CLIProcessService 统一处理方案
- 大输出落盘，只保留摘要

---

### 中风险问题

#### 4. 服务定位器模式 / 缺乏依赖注入

**位置:** `src/main/index.ts:25-39`

**问题描述:**
主入口使用全局可变变量存储 15 个服务实例，手动管理依赖关系。

**代码示例:**
```typescript
let projectService: ProjectService
let gitService: GitService
let cliProcessService: CLIProcessService
let claudeCodeService: ClaudeCodeService
// ... 11 个其他服务
```

**风险:**
- 依赖关系硬编码，难以修改
- 单元测试困难，需要 mock 所有依赖
- 添加新服务需要修改多处代码
- 循环依赖风险

**建议:**
```typescript
// 创建 DI 容器
class ServiceContainer {
  private services: Map<string, any> = new Map()

  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory())
  }

  get<T>(name: string): T {
    return this.services.get(name)
  }
}

// 或使用现有库如 tsyringe、inversify
```

---

#### 5. 生命周期管理缺失

**位置:** `src/main/index.ts:242-246`

**问题描述:**
应用退出时只关闭了数据库连接，其他服务的子进程、计时器、事件订阅未显式释放。

**代码示例:**
```typescript
app.on('before-quit', () => {
  if (databaseService) {
    databaseService.close()  // 只关闭了 DB
  }
  // CLIProcessService 的子进程？
  // PipelineService 的执行？
  // 各种 EventEmitter 订阅？
})
```

**风险:**
- 子进程成为孤儿进程
- 资源泄漏
- 数据不一致

**建议:**
```typescript
interface Lifecycle {
  initialize(): Promise<void>
  dispose(): Promise<void>
}

class LifecycleManager {
  private services: Lifecycle[] = []

  register(service: Lifecycle): void {
    this.services.push(service)
  }

  async disposeAll(): Promise<void> {
    for (const service of this.services.reverse()) {
      await service.dispose()
    }
  }
}
```

---

#### 6. 领域类型分散且重复

**位置:**
- `src/main/types.ts:1` (空文件)
- `src/main/services/DatabaseService.ts:6`
- `src/main/services/TaskService.ts:10`
- `src/main/services/ProjectService.ts:7`

**问题描述:**
类型定义分散在各个服务文件中，`types.ts` 是空文件。DB 层和服务层各自定义类似类型，容易产生漂移。

**风险:**
- 类型不一致导致运行时错误
- 重复定义增加维护成本
- 重构困难

**建议:**
```typescript
// src/main/types/index.ts
export interface Project {
  id: string
  name: string
  path: string
  // ...
}

export interface Task {
  id: string
  projectId: string
  // ...
}

// 各服务统一引用
import { Project, Task } from '../types'
```

---

### 低风险问题

#### 7. IPC 通道名分散

**位置:** `src/main/ipc/*.ipc.ts`

**问题描述:**
IPC 通道名在各个 `.ipc.ts` 文件中硬编码，主进程和渲染进程需要保持一致，容易出错。

**风险:**
- 通道名拼写错误难以发现
- 主/渲染端不一致
- 重构困难

**建议:**
```typescript
// src/main/ipc/channels.ts
export const IpcChannels = {
  Projects: {
    GetAll: 'projects:getAll',
    Create: 'projects:create',
    Delete: 'projects:delete',
  },
  Tasks: {
    GetAll: 'tasks:getAll',
    Create: 'tasks:create',
  },
  // ...
} as const

// 主进程和渲染进程共同引用
```

---

## 架构优点

尽管存在上述问题，当前架构也有值得肯定的设计：

| 优点 | 说明 |
|------|------|
| 分层清晰 | 工具层 → 配置层 → 数据层 → 业务层 → IPC层 |
| 安全性完善 | 命令白名单、URL检查、文件系统白名单、IPC验证 |
| 可扩展性强 | 适配器模式支持多种 CLI 工具和日志格式 |
| 事件驱动 | 基于 EventEmitter 解耦主进程与渲染进程 |

---

## 改进优先级

| 优先级 | 问题 | 影响 | 工作量 |
|--------|------|------|--------|
| **P0** | 数据库删除风险 | 高 | 小 |
| **P0** | CLI 输出内存累积 | 高 | 中 |
| **P1** | 依赖注入容器 | 中 | 中 |
| **P1** | 生命周期管理 | 中 | 小 |
| **P1** | 类型统一 | 中 | 中 |
| **P2** | IPC 通道集中 | 低 | 小 |

---

## 行动计划

### 第一阶段：修复高风险问题

1. **数据库安全**
   - 添加备份机制
   - 添加用户确认对话框
   - 记录操作日志

2. **内存控制**
   - 实现 RingBuffer 类
   - 应用到 CLIProcessService 和 PipelineService

### 第二阶段：架构改进

3. **依赖注入**
   - 创建 ServiceContainer
   - 重构 index.ts

4. **生命周期管理**
   - 定义 Lifecycle 接口
   - 各服务实现 dispose()

5. **类型统一**
   - 整理到 src/main/types/
   - 更新各服务引用

### 第三阶段：代码质量

6. **IPC 通道集中**
   - 创建 src/main/ipc/channels.ts
   - 更新主进程和渲染进程

---

## 已实施改进 (2026-02-03)

### 1. 生命周期与服务编排

- 新增 `AppContext`，统一构建服务并提供 `init/dispose` 生命周期。
- 通过 `trackDisposable/trackEvent` 统一回收订阅和事件监听。
- 应用退出时调用 `AppContext.dispose()`，确保服务资源释放。

### 2. 输出内存控制 + 可选落盘

- 引入 `OutputBuffer`（环形缓冲）限制 CLI/Pipeline 输出。
- CLI 与 Pipeline 输出都带 `truncated` 标记。
- 可选 `OutputSpooler` 落盘（默认关闭），支持轮转和批量写入。

### 3. 数据库安全迁移

- legacy 数据库探测改为**非破坏性**。
- destructive reset 前强制备份 + 用户确认。
- 失败自动回滚并弹窗提示。

### 4. 测试覆盖

- 新增输出截断和生命周期释放顺序测试。
- 新增数据库备份/恢复路径测试。

### 5. IPC 合约注册表

- 新增 `src/main/ipc/channels.ts` 统一维护 IPC 通道/事件常量与 payload 类型。
- 主进程与 preload 统一引用常量，避免通道名漂移。

### 6. 剩余待办

- 类型统一与 domain DTO 整理仍在待办。

---

## 总结

当前架构整体合理，分层清晰，安全设计完善。主要改进点集中在：

- **数据安全** - 避免误删数据库
- **内存控制** - 防止输出累积导致内存泄漏
- **生命周期** - 确保资源正确释放
- **类型一致性** - 统一领域类型定义

建议按优先级逐步改进，优先解决高风险问题。
