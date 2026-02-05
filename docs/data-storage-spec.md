# VibeWork 数据存储规范

## 1. 存储位置

### 根目录
```
~/.vibework/
```

选择用户根目录下的隐藏文件夹作为数据存储位置，原因：
- 应用卸载后数据保留，重装可恢复
- 符合开发者工具惯例（如 `.npm`、`.cargo`、`.claude`）
- 便于用户手动备份和迁移

### 目录结构
```
~/.vibework/
├── config/           # 应用配置
│   └── settings.json # 通用设置（主题、颜色等）
├── data/             # 持久化数据
│   ├── vibework.db   # SQLite 数据库（项目、任务、工作流等）
│   └── sessions/     # 会话数据（1 Task = 1 Log）
│       └── <project_id>/
│           └── <task_id>.jsonl
├── logs/             # 日志文件
│   └── app.log
└── cache/            # 缓存数据（可清理）
    └── ...
```

## 2. 存储类型选择

### JSON 文件适用场景

| 场景 | 示例 |
|------|------|
| 通用配置 | `settings.json` - 主题、语言、颜色 |
| 需要人工编辑 | 用户可能手动修改的配置 |
| 数据量小 | 总大小 < 100KB |
| Agent/CLI 执行日志 | `<task_id>.jsonl` - 每行一条日志 |

### SQLite 数据库适用场景

| 场景 | 示例 |
|------|------|
| 项目数据 | projects 表 - 项目列表 |
| 关系型数据 | tasks、workflows、work_nodes 等 |
| 需要查询 | 按时间、状态筛选任务 |
| 数据量大 | 历史任务、工作流记录等 |
| 需要事务 | 多表关联操作 |
| 高频读写 | 实时更新的数据 |

## 3. 文件说明

### config/settings.json
通用应用设置，由主进程 SettingsService 管理：
```json
{
  "theme": "system",
  "accentColor": "#3b82f6",
  "backgroundStyle": "default",
  "language": "zh-CN",
  "notifications": {
    "enabled": true,
    "sound": true
  }
}
```

### data/vibework.db
SQLite 数据库，包含以下表：

| 表名 | 用途 |
|------|------|
| projects | 项目列表 |
| tasks | 任务记录 |
| workflows | 工作流实例 |
| workflow_templates | 工作流模板 |
| workflow_template_nodes | 工作流模板节点 |
| work_nodes | 工作节点实例 |
| agent_executions | Agent 执行记录 |

### data/sessions/<project_id>/<task_id>.jsonl
仅保存 Agent/CLI 执行产生的数据（**1 Task = 1 Log**），不保存用户消息或对话内容。
每行一条 JSON，建议包含：
`id, task_id, session_id, type, content|entry|exit_code, created_at, meta, schema_version`

其中 `type` 建议为：`stdout` / `stderr` / `normalized` / `finished`。
`type=normalized` 时，`entry` 内可包含工具相关信息（如 tool_name、tool_input、tool_output 等）。

#### projects 表结构
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

## 4. 路径获取 API

### 主进程（Main Process）
```typescript
import { getAppPaths } from './services/AppPaths'

const appPaths = getAppPaths()

// 获取各目录路径
appPaths.getRootDir()      // ~/.vibework/
appPaths.getConfigDir()    // ~/.vibework/config/
appPaths.getDataDir()      // ~/.vibework/data/
appPaths.getLogsDir()      // ~/.vibework/logs/
appPaths.getCacheDir()     // ~/.vibework/cache/
appPaths.getSessionsDir()  // ~/.vibework/data/sessions/
appPaths.getTaskDataDir(taskId) // ~/.vibework/data/sessions/<project_id>/<task_id>/
appPaths.getTaskMessagesFile(taskId) // ~/.vibework/data/sessions/<project_id>/<task_id>.jsonl

// 获取具体文件路径
appPaths.getProjectsFile() // ~/.vibework/data/projects.json
appPaths.getDatabaseFile() // ~/.vibework/data/vibework.db
appPaths.getSettingsFile() // ~/.vibework/config/settings.json
```

### 渲染进程（Renderer Process）
```typescript
// 获取数据根目录
const dataDir = await window.api.path.vibeworkDataDir()
// 返回: /Users/xxx/.vibework

// 获取 task 日志文件
const messagesFile = `${dataDir}/data/sessions/${projectId}/${taskId}.jsonl`

// 获取通用设置
const settings = await window.api.settings.get()

// 更新通用设置
await window.api.settings.update({
  theme: 'dark',
  accentColor: 'blue'
})

// 重置设置为默认值
await window.api.settings.reset()
```

## 5. 数据迁移

本版本不做历史迁移：旧数据直接忽略/丢弃，启动后使用新结构与新路径。

## 6. 最佳实践

### 读写操作
```typescript
// 正确：使用 AppPaths 获取路径
const appPaths = getAppPaths()
const dbPath = appPaths.getDatabaseFile()

// 错误：硬编码路径
const dbPath = '/Users/xxx/.vibework/data/vibework.db'

// 错误：硬编码 task 日志路径
const messagesFile = `/Users/xxx/.vibework/data/sessions/${projectId}/${taskId}.jsonl`

// 错误：使用 app.getPath('userData')
const dbPath = join(app.getPath('userData'), 'vibework.db')
```

### 错误处理
```typescript
// 文件操作应包含错误处理
try {
  const data = readFileSync(appPaths.getProjectsFile(), 'utf-8')
  return JSON.parse(data)
} catch (error) {
  console.error('Failed to read projects:', error)
  return { projects: [] } // 返回默认值
}
```

### 数据验证
```typescript
// 写入前验证数据
function createProject(input: CreateProjectInput): Project {
  // 验证必填字段
  if (!input.name || !input.path) {
    throw new Error('Invalid project data: name and path are required')
  }

  // 通过 DatabaseService 创建项目
  return databaseService.createProject(input)
}
```

## 7. 安全注意事项

1. **不存储敏感信息**：API 密钥、密码等应使用系统钥匙串
2. **文件权限**：确保数据目录权限为 700（仅用户可访问）
3. **备份提醒**：重要操作前提醒用户备份数据
4. **数据校验**：读取数据时验证格式，防止损坏数据导致崩溃
