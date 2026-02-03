## Context

Vibework 的 `src/main` 目录是 Electron 主进程代码，负责窗口管理、IPC 通信、子进程管理等核心功能。代码审查发现 18 个问题，包括：

- **安全漏洞**: Shell 注入（GitService）、IPC 权限过宽（sandbox 关闭）、命令执行入口过多
- **资源泄漏**: logStreamSubscriptions 未清理、事件监听器泄漏、进程管理不当
- **代码质量**: 主文件过长（1437行）、错误处理不一致、缺少输入验证

当前状态：
- `webPreferences.sandbox = false`，渲染进程可访问高权限 IPC
- 多处使用 `exec()` 字符串拼接执行命令
- 资源清理依赖手动调用，缺少自动生命周期管理

## Goals / Non-Goals

**Goals:**
- 消除所有 P0 安全漏洞（Shell 注入、IPC 权限过宽）
- 修复所有 P1 资源泄漏问题
- 建立统一的安全命令执行模式
- 建立统一的 IPC 响应格式和错误处理
- 将主文件拆分为可维护的模块

**Non-Goals:**
- 不重构整体架构（保持现有服务层结构）
- 不引入新的框架或重大依赖（除 zod）
- 不改变现有功能行为（仅修复和加固）
- 不处理渲染进程代码

## Decisions

### 1. 命令执行安全化

**决策**: 使用 `execFile/spawn` + 参数数组替代 `exec()` 字符串拼接

**理由**:
- `execFile` 不经过 shell 解析，参数作为独立数组传递，从根本上防止注入
- 相比正则转义方案，更简单可靠，无需维护转义规则
- Node.js 原生支持，无需额外依赖

**替代方案**:
- 使用 shell-escape 库转义参数 → 仍有绕过风险，增加依赖
- 使用 simple-git 等封装库 → 增加依赖，学习成本

### 2. IPC 安全边界

**决策**: 启用 sandbox + contextIsolation，实现路径/协议白名单

**理由**:
- sandbox 隔离渲染进程，即使被注入也无法直接访问系统
- 白名单机制限制可操作范围，遵循最小权限原则
- 使用 `realpath` 解析防止路径遍历攻击

**实现**:
- 文件操作白名单: workspace 目录、用户选择的目录
- URL 协议白名单: 仅 `http://` 和 `https://`
- 高风险操作（删除/覆盖）需用户确认

### 3. 资源生命周期管理

**决策**: 使用 WeakRef + FinalizationRegistry 或事件监听自动清理

**理由**:
- webContents destroyed 事件可靠触发，适合订阅清理
- 进程退出事件可靠触发，适合会话清理
- 避免依赖手动调用，减少遗漏风险

**实现**:
- logStreamSubscriptions: 监听 webContents.destroyed
- 事件监听器: 在 cleanupSession 中 removeAllListeners
- 进程管理: 等待 exit 事件，超时后 SIGKILL

### 4. IPC 响应格式统一

**决策**: 使用 `{ success, data?, error? }` 包装器

**理由**:
- 统一格式便于渲染进程处理
- 错误信息结构化，便于展示和日志
- 包装器模式减少重复代码

### 5. 主文件拆分策略

**决策**: 按功能域拆分到 `src/main/ipc/` 目录

**理由**:
- 按功能聚合，便于查找和维护
- 保持现有 IPC 名称不变，无需修改渲染进程
- 渐进式重构，可分批迁移

**目录结构**:
```
src/main/ipc/
├── index.ts          # 统一注册
├── project.ipc.ts    # 项目相关
├── task.ipc.ts       # 任务相关
├── database.ipc.ts   # 数据库相关
├── git.ipc.ts        # Git 相关
├── preview.ipc.ts    # 预览相关
└── fs.ipc.ts         # 文件系统相关
```

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| sandbox 启用可能破坏现有功能 | 分阶段启用，先测试关键路径 |
| 白名单过严影响用户体验 | 提供用户确认机制，允许临时授权 |
| 重构引入回归 | 保持 IPC 接口不变，添加测试覆盖 |
| execFile 不支持 shell 特性（管道、重定向） | 仅在受控场景使用 shell: true |

## Migration Plan

### 阶段一：安全修复（P0）
1. 修改 GitService 使用 execFile
2. 修改其他命令执行入口
3. 添加 IPC 白名单校验
4. 启用 sandbox（需充分测试）

### 阶段二：资源管理（P1）
1. 添加 webContents destroyed 监听
2. 修复事件监听器清理
3. 修复进程管理

### 阶段三：代码质量（P2-P3）
1. 创建 IPC 响应包装器
2. 添加 zod 验证
3. 拆分主文件

### 回滚策略
- 每个阶段独立提交，可单独回滚
- sandbox 启用通过配置开关控制
- 保留原有代码注释，便于对比

## Open Questions

1. **sandbox 启用后的兼容性测试范围？** 需要确定关键测试用例
2. **白名单配置是否需要持久化？** 用户授权的目录是否跨会话保留
3. **日志轮转策略？** 按大小还是按时间，保留多少历史
