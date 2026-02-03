## 1. 安全命令执行 (P0)

- [ ] 1.1 创建 `src/main/utils/secure-exec.ts` 封装 execFile/spawn 工具函数
- [ ] 1.2 重构 `GitService.ts` 所有命令使用 execFile + 参数数组
- [ ] 1.3 重构 `PipelineService.ts` 命令执行使用 spawn + args
- [ ] 1.4 重构 `PreviewService.ts` 命令执行使用 spawn + args
- [ ] 1.5 重构 `CLIProcessService.ts` 命令执行使用 spawn + args
- [ ] 1.6 重构 `ProcessCliSession.ts` 命令执行使用 spawn + args
- [ ] 1.7 重构 `EditorService.ts` 命令执行使用 execFile + args
- [ ] 1.8 添加命令白名单配置和校验逻辑
- [ ] 1.9 添加命令执行超时控制（默认 30 秒）

## 2. IPC 安全边界 (P0)

- [ ] 2.1 在 `index.ts` 启用 `sandbox: true` 和 `contextIsolation: true`
- [ ] 2.2 创建 `src/main/utils/path-validator.ts` 路径白名单校验工具
- [ ] 2.3 为 `fs:*` IPC 添加路径白名单校验
- [ ] 2.4 为 `shell:openUrl` IPC 添加协议白名单（仅 http/https）
- [ ] 2.5 为文件删除/覆盖操作添加用户确认对话框

## 3. 资源生命周期管理 (P1)

- [ ] 3.1 修复 `logStreamSubscriptions` 添加 webContents.destroyed 监听自动清理
- [ ] 3.2 修复 `ClaudeCodeService.ts` 在 cleanupSession 中移除所有事件监听器
- [ ] 3.3 修复 `PreviewService.ts` stopPreview 等待进程退出并添加超时强杀
- [ ] 3.4 修复 `CLIProcessService.ts` 在 close 事件中移除 session

## 4. IPC 响应格式统一 (P2)

- [ ] 4.1 创建 `src/main/utils/ipc-response.ts` 响应包装器
- [ ] 4.2 重构数据库相关 IPC 使用 wrapHandler
- [ ] 4.3 重构任务相关 IPC 使用 wrapHandler
- [ ] 4.4 重构项目相关 IPC 使用 wrapHandler
- [ ] 4.5 重构其他 IPC 使用 wrapHandler

## 5. 输入验证 (P2)

- [ ] 5.1 添加 zod 依赖到 package.json
- [ ] 5.2 创建 `src/main/utils/validators.ts` 定义验证 schemas
- [ ] 5.3 为 task 相关 IPC 添加 zod 验证
- [ ] 5.4 为 project 相关 IPC 添加 zod 验证
- [ ] 5.5 移除 `as any` 类型转换，使用类型守卫替代

## 6. 日志存储优化 (P2)

- [ ] 6.1 重构 `MsgStoreService.ts` 使用异步写入队列
- [ ] 6.2 实现日志批量写入（节流/批处理）
- [ ] 6.3 添加日志文件大小限制（10MB）
- [ ] 6.4 实现日志轮转机制（最多 5 个历史文件）

## 7. Pipeline 取消修复 (P2)

- [ ] 7.1 在 `PipelineService.ts` StageExecution 中保存子进程引用
- [ ] 7.2 修改 cancelExecution 终止正在运行的子进程

## 8. 主文件拆分 (P3)

- [ ] 8.1 创建 `src/main/ipc/` 目录结构
- [ ] 8.2 提取项目相关 IPC 到 `project.ipc.ts`
- [ ] 8.3 提取任务相关 IPC 到 `task.ipc.ts`
- [ ] 8.4 提取数据库相关 IPC 到 `database.ipc.ts`
- [ ] 8.5 提取 Git 相关 IPC 到 `git.ipc.ts`
- [ ] 8.6 提取预览相关 IPC 到 `preview.ipc.ts`
- [ ] 8.7 提取文件系统相关 IPC 到 `fs.ipc.ts`
- [ ] 8.8 创建 `ipc/index.ts` 统一注册入口
- [ ] 8.9 精简 `index.ts` 至 300 行以内

## 9. 配置与性能优化 (P3)

- [ ] 9.1 创建 `src/main/config/index.ts` 配置模块
- [ ] 9.2 提取硬编码配置到配置模块
- [ ] 9.3 优化 `DataBatcher.ts` 字符串拼接使用数组 join
- [ ] 9.4 修复 `EditorService.ts` 异步初始化问题
- [ ] 9.5 为 `DatabaseService.ts` 添加旧数据库备份机制
