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
│   └── vibework.db   # SQLite 数据库（项目、会话、任务等）
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

### SQLite 数据库适用场景

| 场景 | 示例 |
|------|------|
| 项目数据 | projects 表 - 项目列表 |
| 关系型数据 | sessions、tasks、messages 表 |
| 需要查询 | 按时间、状态筛选任务 |
| 数据量大 | 历史记录、日志等 |
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
| sessions | 会话记录 |
| tasks | 任务记录 |
| messages | 消息记录 |
| files | 文件库 |

#### projects 表结构
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  config TEXT,
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

### 自动迁移
应用启动时自动检测并迁移旧数据：
- 旧位置：`~/Library/Application Support/vibework/`
- 新位置：`~/.vibework/`

迁移逻辑：
1. 检查旧位置是否存在数据
2. 检查新位置是否已有数据
3. 如果新位置为空，复制旧数据到新位置
4. 保留旧数据（不删除，由用户决定）

### 迁移文件
- `vibework.db` → `~/.vibework/data/vibework.db`
- `vibework.db-wal` → `~/.vibework/data/vibework.db-wal`
- `vibework.db-shm` → `~/.vibework/data/vibework.db-shm`

## 6. 最佳实践

### 读写操作
```typescript
// 正确：使用 AppPaths 获取路径
const appPaths = getAppPaths()
const dbPath = appPaths.getDatabaseFile()

// 错误：硬编码路径
const dbPath = '/Users/xxx/.vibework/data/vibework.db'

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
