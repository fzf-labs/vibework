## Context

任务详情页右侧的 Git 面板目前仅有占位 UI，未调用现有的 Git IPC API。仓库侧已具备完整的 GitService 与 IPC handler（getChangedFiles/getCommitLog/getBranches/getCurrentBranch/stage/unstage/checkout 等），前端未接入。当前右侧面板是 Tab 结构（文件预览 / 开发服务器 / Git），Git 子 Tab 还没有真实数据和交互。

## Goals / Non-Goals

**Goals:**
- 在任务详情页 Git 面板中展示当前分支、变更文件、提交历史与分支列表。
- 支持变更文件刷新与单文件暂存/取消暂存。
- 在无工作目录、非 Git 仓库或 Git 不可用时提供清晰的空状态/错误提示。

**Non-Goals:**
- 提交、合并、变基、冲突处理、推送、PR 创建等复杂操作。
- 完整的 diff 浏览器或文件比较器。
- 修改后端 GitService 的实现逻辑。

## Decisions

- **沿用现有 IPC API**：前端直接调用 `window.api.git.*`，不新增后端接口，降低改动范围。
  - 备选：新增聚合 API 一次性返回所有数据；未选因为需要后端改动且缺乏必要性。
- **按 Tab 懒加载数据**：进入 Git 面板后，按子 Tab（changes/history/branches）触发加载；提供刷新按钮。
  - 备选：一次性拉取所有数据；未选因为浪费请求且对大仓库不友好。
- **变更文件状态直接展示 porcelain 解析结果**：沿用 GitService 返回的 `status`/`staged` 字段；UI 用颜色/标识区分。
  - 备选：重新解析 diff 或引入更复杂的数据模型；未选因为现有字段已满足需求。
- **错误处理统一在面板级别**：API 调用失败时显示错误提示，并保留刷新入口。
  - 备选：弹窗错误；未选因为频繁弹窗会干扰任务流。

## Risks / Trade-offs

- [Risk] 大型仓库变更文件过多导致渲染卡顿 → Mitigation: 首次只在 Git 面板激活时加载，后续考虑虚拟列表。
- [Risk] `git status --porcelain` 无法区分复杂状态 → Mitigation: 先按现有字段显示，后续需要再扩展展示逻辑。
- [Risk] 非 Git 目录会触发 IPC 报错 → Mitigation: 捕获错误并显示“非 Git 仓库/无法读取”提示。

## Migration Plan

- 无数据迁移。
- 前端功能发布即可生效；若出现问题可回退 UI 改动。

## Open Questions

- 是否需要在 Git 面板增加“提交”与“推送”入口？目前不纳入本次范围。
- 分支切换是否需要二次确认（避免干扰任务工作目录）？暂不强制。
