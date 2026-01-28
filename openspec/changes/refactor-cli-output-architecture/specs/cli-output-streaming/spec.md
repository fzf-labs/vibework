## ADDED Requirements

### Requirement: 消息存储服务

系统 SHALL 提供 MsgStore 服务，用于存储和广播 CLI 输出消息。

#### Scenario: 消息推送和广播
- **WHEN** CLI 进程产生 stdout 或 stderr 输出
- **THEN** 输出被封装为 LogMsg 并存储到 MsgStore
- **AND** 所有订阅者通过 EventEmitter 接收到消息

#### Scenario: 容量限制和自动淘汰
- **WHEN** 存储的消息总大小超过配置的 maxBytes 限制
- **THEN** 自动淘汰最早的消息直到满足限制
- **AND** 新消息正常存储

#### Scenario: 历史回放
- **WHEN** 新的订阅者订阅日志流
- **THEN** 首先接收到所有历史消息
- **AND** 然后接收实时消息

### Requirement: IPC 日志流接口

系统 SHALL 通过 IPC 通道提供日志流的订阅和管理接口。

#### Scenario: 订阅日志流
- **WHEN** 渲染进程调用 logStream:subscribe 并传入 sessionId
- **THEN** 主进程开始向该渲染进程推送对应 session 的日志消息
- **AND** 返回订阅成功状态

#### Scenario: 取消订阅
- **WHEN** 渲染进程调用 logStream:unsubscribe
- **THEN** 主进程停止向该渲染进程推送日志消息
- **AND** 释放相关资源

#### Scenario: 获取历史日志
- **WHEN** 渲染进程调用 logStream:getHistory
- **THEN** 返回当前存储的所有历史日志消息

### Requirement: 前端日志流 Hook

系统 SHALL 提供 useLogStream Hook 用于管理日志流订阅和状态。

#### Scenario: 自动订阅和清理
- **WHEN** 组件挂载并传入有效的 sessionId
- **THEN** 自动订阅对应 session 的日志流
- **AND** 组件卸载时自动取消订阅

#### Scenario: 状态更新
- **WHEN** 接收到新的日志消息
- **THEN** 更新 logs 状态数组
- **AND** 触发组件重新渲染
