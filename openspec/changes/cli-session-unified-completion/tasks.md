## 1. Core Session Service

- [x] 1.1 Add CliSessionService with session lifecycle, log storage, and status events
- [x] 1.2 Define CLI adapter interface and registry for tool-specific commands/parsers

## 2. CLI Adapters & Completion Detection

- [x] 2.1 Implement claude-code adapter with stream-json completion detection
- [x] 2.2 Implement cursor-agent adapter with stream-json completion detection
- [x] 2.3 Implement gemini-cli adapter using ACP mode completion detection
- [x] 2.4 Implement codex adapter using app-server JSON-RPC completion detection
- [x] 2.5 Implement opencode adapter using SDK event completion detection

## 3. IPC & Log Streaming

- [x] 3.1 Add cliSession IPC handlers and keep claudeCode IPC as wrapper
- [x] 3.2 Route logStream subscriptions through CliSessionService for all CLIs

## 4. Renderer Integration

- [x] 4.1 Replace ClaudeCodeSession with generic CLISession component
- [x] 4.2 Update TaskDetail to render CLISession for any task CLI tool

## 5. Cleanup & Validation

- [x] 5.1 Deprecate/trim old CLIProcessService usage
- [x] 5.2 Smoke-test status transitions for each CLI type
