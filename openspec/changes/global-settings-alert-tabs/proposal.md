## Why

当前全局设置缺少任务完成后的提醒配置，用户无法在任务结束时得到及时反馈。增加“提示音”和“通知”两个选项卡，让用户可以按需开启声音与桌面通知，提升可达性与效率。

## What Changes

- 在全局设置中新增两个 Tab：提示音、通知
- 支持在任务完成时播放提示音
- 支持在任务完成时发送桌面通知（右上角提示）

## Capabilities

### New Capabilities
- `sound-alerts`: 全局设置中配置任务完成后的提示音提醒
- `desktop-notifications`: 全局设置中配置任务完成后的桌面通知提醒

### Modified Capabilities

## Impact

- 设置页 UI 结构与路由/状态管理
- 任务完成事件的提醒触发逻辑
- 系统通知权限与通知 API 适配
