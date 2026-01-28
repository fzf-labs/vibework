# CLI 输出展示技术架构文档

本文档详细分析 vibe-kanban 项目中 CLI 输出的获取、处理和展示的完整技术架构。

## 目录

- [概述](#概述)
- [整体架构](#整体架构)
- [后端实现](#后端实现)
  - [AI Agent 进程管理](#ai-agent-进程管理)
  - [输出流捕获](#输出流捕获)
  - [消息存储与广播](#消息存储与广播)
  - [日志解析与标准化](#日志解析与标准化)
  - [WebSocket API](#websocket-api)
- [前端实现](#前端实现)
  - [数据获取](#数据获取)
  - [渲染技术](#渲染技术)
- [数据流详解](#数据流详解)
- [关键技术栈](#关键技术栈)

---

## 概述

vibe-kanban 的 CLI 输出展示系统涉及多个技术层面：

1. **后端 (Rust)**: 管理 AI Agent 子进程，捕获其输出，解析 JSON 日志，通过 WebSocket 实时推送
2. **前端 (React/TypeScript)**: 通过 WebSocket 接收日志，使用虚拟化列表高效渲染，支持 ANSI 颜色码

CLI 输出**并非**后端直接执行命令的结果，而是 AI Agent（如 Claude Code、Codex、Droid 等）在其沙箱环境中执行命令后，以 JSON 格式输出的结构化结果。

---

## 整体架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              后端 (Rust)                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. AI Agent 进程 (Claude Code / Codex / Droid 等)                        │
│     │                                                                    │
│     ├─→ stdout ─┐                                                        │
│     │           │                                                        │
│     └─→ stderr ─┼─→ 2. MsgStore (内存存储 + broadcast)                    │
│                 │        │                                               │
│                 │        ├─→ LogMsg::Stdout(content)                     │
│                 │        ├─→ LogMsg::Stderr(content)                     │
│                 │        └─→ LogMsg::JsonPatch(...)                      │
│                 │                                                        │
│                 └─→ 3. normalize_logs() 解析 JSON 输出                    │
│                           │                                              │
│                           └─→ NormalizedEntry (结构化数据)                │
│                                  ├─→ 命令调用: ActionType::CommandRun    │
│                                  ├─→ 文件操作: ActionType::FileEdit      │
│                                  └─→ 消息: AssistantMessage / UserMessage│
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                             API 路由层                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  /api/execution-processes/{id}/raw-logs/ws                               │
│     → 原始 stdout/stderr 流 (实时)                                        │
│                                                                          │
│  /api/execution-processes/{id}/normalized-logs/ws                        │
│     → 标准化日志流 (解析后的结构化数据)                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            前端 (React)                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  useLogStream hook                                                       │
│     │                                                                    │
│     └─→ WebSocket 连接到 /raw-logs/ws                                    │
│           │                                                              │
│           └─→ 接收 LogMsg.JsonPatch 消息                                 │
│                  │                                                       │
│                  └─→ STDOUT / STDERR 类型分发到 logs 状态                 │
│                                                                          │
│  VirtualizedProcessLogs → RawLogText → AnsiHtml (渲染)                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 后端实现

### AI Agent 进程管理

AI Agent 作为子进程启动，后端通过 `tokio::process::Command` 创建进程：

**文件位置**: `crates/executors/src/executors/claude.rs`

```rust
// Claude Code 启动命令示例
let mut command = Command::new("npx");
command
    .args(["-y", "@anthropic-ai/claude-code@2.1.12"])
    .args(["-p", "--verbose", "--output-format=stream-json"])
    .kill_on_drop(true)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())   // 捕获 stdout
    .stderr(Stdio::piped())   // 捕获 stderr
    .current_dir(working_dir);
```

支持的 AI Agent 类型：
- Claude Code (`@anthropic-ai/claude-code`)
- OpenCode
- Codex
- Droid
- Cursor
- Copilot
- 等

### 输出流捕获

**文件位置**: `crates/executors/src/stdout_dup.rs`

使用管道复制技术捕获子进程的 stdout/stderr，同时保持原有输出流功能：

```rust
/// 复制 stdout 流，创建一个镜像流用于日志记录
pub fn duplicate_stdout(
    child: &mut AsyncGroupChild,
) -> Result<BoxStream<'static, std::io::Result<String>>, ExecutorError> {
    // 1. 获取原始 stdout
    let original_stdout = child.inner().stdout.take().ok_or_else(|| {
        ExecutorError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Child process has no stdout",
        ))
    })?;

    // 2. 创建新的管道
    let (pipe_reader, pipe_writer) = os_pipe::pipe()?;
    child.inner().stdout = Some(wrap_fd_as_child_stdout(pipe_reader)?);

    // 3. 创建复制流通道
    let (dup_writer, dup_reader) = tokio::sync::mpsc::unbounded_channel();

    // 4. 异步任务：读取原始输出，同时写入管道和复制流
    tokio::spawn(async move {
        let mut stdout_stream = ReaderStream::new(original_stdout);
        while let Some(res) = stdout_stream.next().await {
            match res {
                Ok(data) => {
                    // 写入新的 stdout 管道
                    fd_writer.write_all(&data).await;
                    // 发送到复制流
                    let string_chunk = String::from_utf8_lossy(&data).into_owned();
                    dup_writer.send(Ok(string_chunk));
                }
                Err(err) => {
                    dup_writer.send(Err(err));
                }
            }
        }
    });

    Ok(Box::pin(UnboundedReceiverStream::new(dup_reader)))
}
```

### 消息存储与广播

**文件位置**: `crates/utils/src/msg_store.rs`

`MsgStore` 是日志系统的核心，提供：
- 内存历史记录（100MB 限制，自动淘汰旧数据）
- 实时广播给所有订阅者

```rust
pub struct MsgStore {
    inner: RwLock<Inner>,                    // 历史记录存储
    sender: broadcast::Sender<LogMsg>,       // 实时广播通道
}

// 消息类型
pub enum LogMsg {
    Stdout(String),           // 标准输出
    Stderr(String),           // 标准错误
    JsonPatch(json_patch::Patch),  // JSON Patch 格式的结构化更新
    SessionId(String),        // 会话 ID
    Finished,                 // 执行完成信号
}

impl MsgStore {
    /// 推送消息到存储和广播
    pub fn push(&self, msg: LogMsg) {
        let _ = self.sender.send(msg.clone()); // 广播给实时监听者
        
        let bytes = msg.approx_bytes();
        let mut inner = self.inner.write().unwrap();
        
        // 自动淘汰旧数据以保持在 100MB 限制内
        while inner.total_bytes.saturating_add(bytes) > HISTORY_BYTES {
            if let Some(front) = inner.history.pop_front() {
                inner.total_bytes = inner.total_bytes.saturating_sub(front.bytes);
            } else {
                break;
            }
        }
        
        inner.history.push_back(StoredMsg { msg, bytes });
        inner.total_bytes = inner.total_bytes.saturating_add(bytes);
    }

    /// 获取历史记录 + 实时流的组合
    pub fn history_plus_stream(
        &self,
    ) -> BoxStream<'static, Result<LogMsg, std::io::Error>> {
        let (history, rx) = (self.get_history(), self.get_receiver());
        let hist = futures::stream::iter(history.into_iter().map(Ok));
        let live = BroadcastStream::new(rx)
            .filter_map(|res| async move { res.ok().map(Ok) });
        Box::pin(hist.chain(live))
    }

    /// 只获取 stdout 行流
    pub fn stdout_lines_stream(
        &self,
    ) -> BoxStream<'static, std::io::Result<String>> {
        self.stdout_chunked_stream().lines()
    }
}
```

### 日志解析与标准化

**文件位置**: `crates/executors/src/executors/droid/normalize_logs.rs`

AI Agent 输出 JSON 格式的日志，需要解析成结构化的 `NormalizedEntry`：

```rust
pub fn normalize_logs(
    msg_store: Arc<MsgStore>,
    worktree_path: &Path,
    entry_index_provider: EntryIndexProvider,
) {
    // 同时处理 stderr
    normalize_stderr_logs(msg_store.clone(), entry_index_provider.clone());

    tokio::spawn(async move {
        let mut lines_stream = msg_store.stdout_lines_stream();

        while let Some(line) = lines_stream.next().await {
            // 解析 AI Agent 的 JSON 输出
            let droid_json = match serde_json::from_str::<DroidJson>(&line) {
                Ok(json) => json,
                Err(_) => {
                    // 非 JSON 输出作为系统消息处理
                    if !line.trim().is_empty() {
                        add_normalized_entry(&msg_store, NormalizedEntry {
                            entry_type: NormalizedEntryType::SystemMessage,
                            content: strip_ansi_escapes::strip_str(&line).to_string(),
                            ..
                        });
                    }
                    continue;
                }
            };

            match droid_json {
                // 工具调用（包括 shell 命令）
                DroidJson::ToolCall { tool_name, parameters, id, .. } => {
                    match tool_name.as_str() {
                        "Execute" => {
                            let command = parameters.get("command").as_str();
                            let tool_state = CommandRunState {
                                command: command.to_string(),
                                output: String::new(),
                                status: ToolStatus::Created,
                                exit_code: None,
                            };
                            // 添加到消息存储
                            add_normalized_entry(&msg_store, tool_state.to_normalized_entry());
                        }
                        // 其他工具类型...
                    }
                }

                // 工具执行结果
                DroidJson::ToolResult { payload, is_error, .. } => {
                    match payload {
                        ToolResultPayload::Value { value } => {
                            let output = value.as_str().unwrap_or_default();
                            // 提取退出码
                            let exit_code = output
                                .lines()
                                .find(|line| line.contains("[Process exited with code"))
                                .and_then(|line| {
                                    line.strip_prefix("[Process exited with code ")?
                                        .strip_suffix("]")?
                                        .parse::<i32>()
                                        .ok()
                                });
                            // 更新条目
                            replace_normalized_entry(&msg_store, CommandRunState {
                                output: output.to_string(),
                                exit_code,
                                status: if is_error { ToolStatus::Failed } else { ToolStatus::Success },
                                ..
                            });
                        }
                        // 错误处理...
                    }
                }

                // AI 助手消息
                DroidJson::Message { role, text, .. } => {
                    let entry_type = match role.as_str() {
                        "user" => NormalizedEntryType::UserMessage,
                        "assistant" => NormalizedEntryType::AssistantMessage,
                        _ => NormalizedEntryType::SystemMessage,
                    };
                    add_normalized_entry(&msg_store, NormalizedEntry {
                        entry_type,
                        content: text,
                        ..
                    });
                }
                // 其他消息类型...
            }
        }
    });
}
```

**AI Agent JSON 输出格式示例：**

```json
// 工具调用
{
  "type": "tool_call",
  "id": "call_123",
  "toolName": "Execute",
  "parameters": {
    "command": "find src -name \"*.json\" -print"
  },
  "timestamp": 1706428800000,
  "session_id": "session_abc"
}

// 工具结果
{
  "type": "tool_result",
  "toolId": "call_123",
  "isError": false,
  "value": "src/config.json\nsrc/data.json\n[Process exited with code 0]",
  "timestamp": 1706428801000,
  "session_id": "session_abc"
}
```

### WebSocket API

**文件位置**: `crates/server/src/routes/execution_processes.rs`

提供两个 WebSocket 端点用于实时日志推送：

```rust
/// 原始日志流 - 推送 stdout/stderr 原始内容
pub async fn stream_raw_logs_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Path(exec_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let raw_stream = deployment
        .container()
        .stream_raw_logs(&exec_id)
        .await
        .ok_or(ApiError::NotFound)?;

    Ok(ws.on_upgrade(move |socket| async move {
        handle_raw_logs_ws(socket, deployment, exec_id).await
    }))
}

async fn handle_raw_logs_ws(socket: WebSocket, ...) -> anyhow::Result<()> {
    let counter = Arc::new(AtomicUsize::new(0));
    
    // 将原始消息转换为 JSON Patch 格式
    let mut stream = raw_stream.map_ok(move |m| match m {
        LogMsg::Stdout(content) => {
            let index = counter.fetch_add(1, Ordering::SeqCst);
            let patch = ConversationPatch::add_stdout(index, content);
            LogMsg::JsonPatch(patch).to_ws_message_unchecked()
        }
        LogMsg::Stderr(content) => {
            let index = counter.fetch_add(1, Ordering::SeqCst);
            let patch = ConversationPatch::add_stderr(index, content);
            LogMsg::JsonPatch(patch).to_ws_message_unchecked()
        }
        LogMsg::Finished => LogMsg::Finished.to_ws_message_unchecked(),
        _ => unreachable!(),
    });

    let (mut sender, mut receiver) = socket.split();
    
    // 转发消息到客户端
    while let Some(item) = stream.next().await {
        match item {
            Ok(msg) => {
                if sender.send(msg).await.is_err() {
                    break; // 客户端断开
                }
            }
            Err(e) => {
                tracing::error!("stream error: {}", e);
                break;
            }
        }
    }
    Ok(())
}

// 路由注册
pub fn router(deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    Router::new()
        .route("/execution-processes/{id}/raw-logs/ws", get(stream_raw_logs_ws))
        .route("/execution-processes/{id}/normalized-logs/ws", get(stream_normalized_logs_ws))
}
```

---

## 前端实现

### 数据获取

**文件位置**: `frontend/src/hooks/useLogStream.ts`

自定义 Hook 管理 WebSocket 连接和日志状态：

```typescript
type LogEntry = { type: 'STDOUT' | 'STDERR'; content: string };

export const useLogStream = (processId: string): UseLogStreamResult => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!processId) return;

    // 清空日志
    setLogs([]);
    setError(null);

    const open = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(
        `${protocol}//${host}/api/execution-processes/${processId}/raw-logs/ws`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setError(null);
        setLogs([]); // 服务器会重放历史，清空本地
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 处理 JSON Patch 格式的消息
          if ('JsonPatch' in data) {
            const patches = data.JsonPatch as Array<{ value?: PatchType }>;
            patches.forEach((patch) => {
              const value = patch?.value;
              if (!value || !value.type) return;

              switch (value.type) {
                case 'STDOUT':
                case 'STDERR':
                  setLogs((prev) => [...prev, { 
                    type: value.type, 
                    content: value.content 
                  }]);
                  break;
              }
            });
          } else if (data.finished === true) {
            ws.close();
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      ws.onerror = () => setError('Connection failed');
      
      ws.onclose = (event) => {
        // 非正常关闭时重试
        if (event.code !== 1000) {
          setTimeout(() => open(), 1000);
        }
      };
    };

    open();

    return () => {
      wsRef.current?.close();
    };
  }, [processId]);

  return { logs, error };
};
```

### 渲染技术

#### 虚拟化列表

**文件位置**: `frontend/src/components/ui-new/containers/VirtualizedProcessLogs.tsx`

使用 `@virtuoso.dev/message-list` 实现高性能虚拟化渲染：

```typescript
import {
  VirtuosoMessageList,
  VirtuosoMessageListLicense,
} from '@virtuoso.dev/message-list';
import RawLogText from '@/components/common/RawLogText';

export function VirtualizedProcessLogs({
  logs,
  error,
  searchQuery,
  matchIndices,
  currentMatchIndex,
}: VirtualizedProcessLogsProps) {
  const [channelData, setChannelData] = useState<DataWithScrollModifier<LogEntryWithKey> | null>(null);
  const messageListRef = useRef<VirtuosoMessageListMethods | null>(null);

  useEffect(() => {
    // 添加 key 和索引
    const logsWithKeys = logs.map((entry, index) => ({
      ...entry,
      key: `log-${index}`,
      originalIndex: index,
    }));

    // 自动滚动到底部
    setChannelData({
      data: logsWithKeys,
      scrollModifier: { type: 'auto-scroll-to-bottom', autoScroll: 'smooth' },
    });
  }, [logs]);

  // 单条日志渲染
  const ItemContent = ({ data, context }) => (
    <RawLogText
      content={data.content}
      channel={data.type === 'STDERR' ? 'stderr' : 'stdout'}
      className="text-sm px-4 py-1"
      linkifyUrls
      searchQuery={context.searchQuery}
    />
  );

  return (
    <VirtuosoMessageListLicense licenseKey={...}>
      <VirtuosoMessageList
        ref={messageListRef}
        className="h-full"
        data={channelData}
        context={{ searchQuery, matchIndices, currentMatchIndex }}
        ItemContent={ItemContent}
      />
    </VirtuosoMessageListLicense>
  );
}
```

#### ANSI 颜色渲染

**文件位置**: `frontend/src/components/common/RawLogText.tsx`

使用 `fancy-ansi` 库解析和渲染 ANSI 转义码：

```typescript
import { AnsiHtml } from 'fancy-ansi/react';
import { hasAnsi } from 'fancy-ansi';

interface RawLogTextProps {
  content: string;
  channel?: 'stdout' | 'stderr';
  className?: string;
  linkifyUrls?: boolean;
  searchQuery?: string;
}

const RawLogText = memo(({
  content,
  channel = 'stdout',
  className,
  linkifyUrls = false,
  searchQuery,
}: RawLogTextProps) => {
  // 检测是否包含 ANSI 码
  const hasAnsiCodes = hasAnsi(content);
  // stderr 在没有 ANSI 码时使用红色
  const shouldApplyStderrFallback = channel === 'stderr' && !hasAnsiCodes;

  const renderContent = () => {
    if (!linkifyUrls) {
      return <AnsiHtml text={content} />;
    }

    // URL 链接化处理
    const urlRegex = /(https?:\/\/\S+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, index) => {
      if (/^https?:\/\/\S+$/.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-info hover:text-info/80"
          >
            {part}
          </a>
        );
      }
      return <AnsiHtml key={index} text={part} />;
    });
  };

  return (
    <div
      className={clsx(
        'font-mono text-xs break-all whitespace-pre-wrap',
        shouldApplyStderrFallback && 'text-error',
        className
      )}
    >
      {renderContent()}
    </div>
  );
});
```

#### CSS ANSI 颜色类

**文件位置**: `frontend/src/styles/new/index.css`

```css
/* ANSI color classes for fancy-ansi */
.new-design .ansi-red { color: #ef4444; }
.new-design .ansi-green { color: #22c55e; }
.new-design .ansi-yellow { color: #eab308; }
.new-design .ansi-blue { color: #3b82f6; }
.new-design .ansi-magenta { color: #d946ef; }
.new-design .ansi-cyan { color: #06b6d4; }
.new-design .ansi-white { color: #f8fafc; }
.new-design .ansi-black { color: #1e293b; }

/* Bright variants */
.new-design .ansi-bright-red { color: #f87171; }
.new-design .ansi-bright-green { color: #4ade80; }
.new-design .ansi-bright-yellow { color: #facc15; }
.new-design .ansi-bright-blue { color: #60a5fa; }
.new-design .ansi-bright-magenta { color: #e879f9; }
.new-design .ansi-bright-cyan { color: #22d3ee; }
.new-design .ansi-bright-white { color: #ffffff; }
.new-design .ansi-bright-black { color: #64748b; }

/* Text styles */
.new-design .ansi-bold { font-weight: 700; }
.new-design .ansi-italic { font-style: italic; }
.new-design .ansi-underline { text-decoration: underline; }
```

---

## 数据流详解

以执行 `find src -name "*.json"` 命令为例：

### 1. AI Agent 决定执行命令

AI Agent (如 Claude Code) 分析用户请求后，决定调用 `Execute` 工具。

### 2. Agent 输出工具调用 JSON

```json
{
  "type": "tool_call",
  "id": "call_find_123",
  "toolName": "Execute",
  "parameters": {
    "command": "find src -name \"*.json\" -print"
  },
  "timestamp": 1706428800000,
  "session_id": "session_abc"
}
```

### 3. 后端解析并创建条目

```rust
// normalize_logs.rs
DroidJson::ToolCall { tool_name: "Execute", parameters, id, .. } => {
    let command = parameters.get("command").as_str();
    let tool_state = CommandRunState {
        command: command.to_string(),
        status: ToolStatus::Created,
        ..
    };
    add_normalized_entry(&msg_store, tool_state.to_normalized_entry());
}
```

### 4. Agent 执行命令并返回结果

Agent 在其沙箱环境中执行 `/bin/zsh -lc find src -name "*.json" -print`

```json
{
  "type": "tool_result",
  "toolId": "call_find_123",
  "isError": false,
  "value": "src/config.json\nsrc/package.json\n[Process exited with code 0]",
  "timestamp": 1706428801500,
  "session_id": "session_abc"
}
```

### 5. 后端更新条目

```rust
DroidJson::ToolResult { payload, is_error, .. } => {
    let output = payload.value.as_str().unwrap();
    let exit_code = 0; // 从输出中解析
    
    replace_normalized_entry(&msg_store, CommandRunState {
        output: output.to_string(),
        exit_code: Some(exit_code),
        status: ToolStatus::Success,
        ..
    });
}
```

### 6. WebSocket 推送

```rust
// JSON Patch 格式
{
  "JsonPatch": [{
    "op": "add",
    "path": "/logs/5",
    "value": {
      "type": "STDOUT",
      "content": "src/config.json\nsrc/package.json\n[Process exited with code 0]"
    }
  }]
}
```

### 7. 前端接收并渲染

```typescript
// useLogStream.ts
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if ('JsonPatch' in data) {
    data.JsonPatch.forEach((patch) => {
      if (patch.value?.type === 'STDOUT') {
        setLogs((prev) => [...prev, { 
          type: 'STDOUT', 
          content: patch.value.content 
        }]);
      }
    });
  }
};
```

---

## 关键技术栈

### 后端

| 技术 | 版本/说明 | 用途 |
|------|-----------|------|
| Rust | - | 主要编程语言 |
| Tokio | 异步运行时 | 异步 I/O 和任务调度 |
| Axum | Web 框架 | HTTP 路由和 WebSocket |
| command_group | - | 进程组管理 |
| os_pipe | - | 跨平台管道创建 |
| serde_json | - | JSON 序列化/反序列化 |
| broadcast channel | tokio::sync | 消息广播 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | - | UI 框架 |
| TypeScript | - | 类型安全 |
| fancy-ansi | ^0.1.3 | ANSI 转义码解析和渲染 |
| @virtuoso.dev/message-list | ^1.13.3 | 虚拟化消息列表 |
| react-virtuoso | ^4.14.0 | 虚拟滚动支持 |
| @xterm/xterm | ^5.5.0 | 交互式终端模拟器 |
| @xterm/addon-fit | ^0.10.0 | 终端自适应大小 |
| @xterm/addon-web-links | ^0.11.0 | 终端 URL 链接支持 |

---

## 组件层级关系

```
LogsContentContainer
├── VirtualizedProcessLogs (虚拟化日志列表)
│   └── RawLogText (单行日志渲染)
│       └── AnsiHtml (ANSI → HTML 转换)
└── TerminalPanelContainer (交互式终端)
    └── XTermInstance
        ├── Terminal (@xterm/xterm)
        ├── FitAddon (自适应大小)
        └── WebLinksAddon (URL 链接)
```

---

## 总结

vibe-kanban 的 CLI 输出展示系统是一个完整的实时日志流水线：

1. **AI Agent 以子进程运行**，其 stdout/stderr 被后端捕获
2. **MsgStore 提供消息存储和广播**，支持历史回放和实时推送
3. **normalize_logs 解析 AI 的 JSON 输出**，转换为结构化的 NormalizedEntry
4. **WebSocket API 实时推送日志**到前端
5. **前端使用虚拟化列表高效渲染**，fancy-ansi 处理 ANSI 颜色码

这种架构确保了：
- 高性能：虚拟化渲染 + 增量更新
- 实时性：WebSocket 推送
- 可靠性：历史回放 + 断线重连
- 可扩展性：支持多种 AI Agent 类型
