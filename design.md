# Design Document: VibeWork 多AI Agent桌面应用

## Context

VibeWork是一个跨平台桌面应用,旨在为命令行AI工具提供统一的图形界面。当前开发者在使用Claude Code、Gemini CLI等工具时,需要在多个终端窗口间切换,缺乏可视化的项目管理和任务编排能力。

### 约束条件
- 必须支持Windows、macOS平台
- 需要与现有CLI工具无缝集成,不修改其行为
- 必须保证Git操作的安全性,避免数据丢失
- 需要支持大型代码仓库(>10000文件)的流畅操作

### 利益相关者
- 开发者:主要用户,需要高效的AI辅助开发工作流
- CLI工具提供商:需要保持工具的独立性和兼容性

## Goals / Non-Goals

### Goals
- 提供统一的多AI Agent管理界面
- 实现基于Git worktree的任务隔离机制
- 支持自定义任务流水线和人工确认
- 提供可视化的Git操作和代码预览
- 支持全局和项目级的配置管理

### Non-Goals
- 不替代CLI工具本身的功能
- 不实现AI模型的训练或微调
- 不提供代码托管服务
- 不实现完整的IDE功能(仅提供预览和基础编辑)

## Decisions

### 1. 架构选择: Electron + React + TypeScript

**决策**: 使用Electron作为桌面应用框架,React作为UI框架,TypeScript作为开发语言。

**理由**:
- Electron提供跨平台能力,一套代码支持三大平台
- React生态成熟,组件库丰富(Radix UI、Tailwind CSS)
- TypeScript提供类型安全,减少运行时错误
- 团队已有相关技术栈经验


### 2. 进程管理: 主进程 + 渲染进程 + IPC通信

**决策**: 采用Electron标准的多进程架构,通过IPC进行通信。

**理由**:
- 主进程负责系统级操作(Git、进程管理、文件系统)
- 渲染进程负责UI展示,保持响应性
- IPC通信保证安全性,避免渲染进程直接访问系统资源

**关键设计**:
```
Main Process:
  - Git操作管理器
  - CLI工具进程管理器
  - 配置存储管理器
  - 文件系统监听器

Renderer Process:
  - React UI组件
  - 状态管理(Zustand/Jotai)
  - IPC客户端封装

Preload Script:
  - 暴露安全的IPC API
  - 类型定义共享
```

### 3. Git Worktree管理: 自动创建 + 生命周期管理

**决策**: 每个任务自动创建独立的git worktree,任务完成后提供清理选项。

**理由**:
- Worktree提供完全隔离的工作环境,避免分支切换影响
- 支持多任务并行开发,不同任务使用不同worktree
- 自动化创建减少手动操作,降低出错概率

**实现细节**:
```
任务创建流程:
1. 用户创建任务,指定基础分支
2. 系统生成唯一的worktree路径: .worktrees/task-{id}
3. 执行: git worktree add .worktrees/task-{id} -b task-{id} origin/main
4. 记录worktree路径到任务元数据

任务完成流程:
1. 用户标记任务完成
2. 提示是否合并到主分支
3. 提示是否删除worktree: git worktree remove .worktrees/task-{id}
4. 清理任务元数据
```

**风险**: Worktree数量过多可能占用磁盘空间,需要提供批量清理功能。

### 4. CLI工具集成: 进程包装 + 输出流捕获

**决策**: 通过子进程启动CLI工具,捕获stdout/stderr,不修改工具本身。

**理由**:
- 保持CLI工具的独立性和更新能力
- 通过环境变量和参数传递配置
- 捕获输出流实现日志展示和状态监控

**抽象接口**:
```typescript
interface CLITool {
  name: string;
  executablePath: string;
  start(workdir: string, args: string[]): Promise<Process>;
  stop(processId: string): Promise<void>;
  sendInput(processId: string, input: string): Promise<void>;
  onOutput(processId: string, callback: (data: string) => void): void;
}
```

**支持的工具**:
- Claude Code (优先级1)
- Codex (优先级2)
- Gemini CLI (优先级3)
- 可扩展支持其他工具

### 5. 任务流水线: 状态机 + 人工确认

**决策**: 使用状态机模式实现流水线,每个环节完成后等待人工确认。

**理由**:
- 状态机清晰表达流水线的状态转换
- 人工确认保证质量,避免自动化错误传播
- 支持环节跳过、重试、回退等操作

**状态机设计**:
```
Task States (任务状态):
  - TO_DO: 待办
  - IN_PROGRESS: 进行中
  - IN_REVIEW: 审查中
  - DONE: 已完成

Task Transitions:
  TO_DO -> IN_PROGRESS: 用户开始任务
  IN_PROGRESS -> IN_REVIEW: 用户提交审查
  IN_REVIEW -> DONE: 审查通过
  IN_REVIEW -> IN_PROGRESS: 审查拒绝,需要修改

Stage States (环节状态):
  - TO_DO: 待执行
  - IN_PROGRESS: 执行中
  - IN_REVIEW: 等待确认
  - DONE: 已完成

Stage Transitions:
  TO_DO -> IN_PROGRESS: 环节开始执行
  IN_PROGRESS -> IN_REVIEW: 环节执行完成
  IN_REVIEW -> DONE: 用户确认通过
  IN_REVIEW -> TO_DO: 用户拒绝,需要重新执行
  TO_DO -> DONE: 用户跳过环节
```

### 6. 配置管理: 分层配置 + 优先级覆盖

**决策**: 实现全局配置和项目配置两层,项目配置覆盖全局配置。

**理由**:
- 全局配置提供默认值,减少重复配置
- 项目配置支持定制化,满足特殊需求
- 优先级覆盖机制清晰,易于理解

**配置结构**:
```
Global Config (~/.vibework/config.json):
  - cliTools: CLI工具路径配置
  - mcpServers: 全局MCP服务器
  - skills: 全局技能配置
  - pipelineTemplates: 流水线模板
  - notifications: 通知设置

Project Config (.vibework/config.json):
  - mcpServers: 项目级MCP服务器(合并到全局)
  - skills: 项目级技能(合并到全局)
  - pipelines: 项目特定流水线
  - previewScripts: 预览脚本配置
  - editorCommand: 打开编辑器的命令
```

## Risks / Trade-offs

### 风险1: CLI工具输出格式变化
- **风险**: CLI工具更新可能改变输出格式,导致解析失败
- **缓解**: 使用宽松的解析策略,只提取关键信息;提供降级模式,显示原始输出

### 风险2: Git操作冲突
- **风险**: 多个worktree同时操作可能导致Git冲突
- **缓解**: 在UI层提示用户当前活跃的worktree;提供冲突检测和解决工具

### 风险3: 大型仓库性能
- **风险**: 大型仓库(>10000文件)可能导致Git操作缓慢
- **缓解**: 使用增量加载和虚拟滚动;提供浅克隆选项;缓存Git状态

### 风险4: 跨平台兼容性
- **风险**: 不同平台的路径、权限、进程管理差异
- **缓解**: 使用Node.js的跨平台API;针对平台特性进行适配;充分测试

### Trade-off: 功能完整性 vs 简洁性
- **选择**: 优先实现核心功能,保持界面简洁
- **理由**: 避免功能过载,降低学习成本;后续根据用户反馈迭代

## Migration Plan

### 阶段1: MVP版本(核心功能)
- 项目管理(克隆、创建)
- Claude Code集成
- 基础任务管理(无流水线)
- Git diff可视化

### 阶段2: 增强版本
- 任务流水线
- 多CLI工具支持
- 代码预览
- 通知系统

### 阶段3: 完整版本
- 配置管理UI
- Git高级操作(merge、rebase、PR)
- 性能优化
- 插件系统(可选)

### 回滚策略
- 保持CLI工具独立性,用户可随时回退到纯命令行使用
- 配置文件使用JSON格式,易于手动编辑和备份
- 不修改Git仓库结构,仅添加.vibework目录

## Open Questions

1. **MCP服务器配置格式**: 是否兼容Claude Code的MCP配置格式?
   - 建议: 完全兼容,支持直接导入

2. **任务流水线模板**: 是否提供预设模板(如"功能开发"、"Bug修复")?
   - 建议: 提供3-5个常用模板,支持自定义

3. **多用户协作**: 是否支持团队共享配置和流水线?
   - 建议: V1不支持,V2考虑通过Git仓库共享配置

4. **插件系统**: 是否支持第三方插件扩展?
   - 建议: V1不支持,V2评估需求后决定

5. **AI模型选择**: 是否允许用户在应用内切换AI模型?
   - 建议: 依赖CLI工具自身的配置,应用不介入
