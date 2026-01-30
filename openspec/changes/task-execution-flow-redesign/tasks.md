## 1. 数据库服务层 - 状态触发机制

- [x] 1.1 在 DatabaseService.updateTask 中添加状态变更检测逻辑
- [x] 1.2 实现 todo → in_progress 时的工作流实例化触发
- [x] 1.3 添加 instantiateWorkflow 方法创建 Workflow 和 WorkNode 实例
- [x] 1.4 实现工作流状态到任务状态的同步逻辑

## 2. 工作流自动化执行

- [x] 2.1 实现第一个 WorkNode 自动启动逻辑
- [x] 2.2 添加 WorkNode 完成后自动推进到下一节点的逻辑
- [x] 2.3 实现 requires_approval 判断：true 进入 in_review，false 直接 done
- [x] 2.4 实现工作流完成时自动更新任务状态为 done

## 3. 审核UI组件

- [x] 3.1 创建 WorkNodeReviewPanel 组件骨架
- [x] 3.2 实现节点信息展示（名称、提示词、执行输出）
- [x] 3.3 实现 Approve 按钮及其点击处理逻辑
- [x] 3.4 实现 Reject 按钮及其点击处理逻辑
- [x] 3.5 添加执行历史展示（AgentExecution 记录列表）

## 4. 工作流进度可视化

- [x] 4.1 创建 WorkflowProgressBar 组件
- [x] 4.2 实现节点状态徽章（WorkNodeStatusBadge）
- [x] 4.3 实现进度百分比计算和展示
- [x] 4.4 添加当前执行节点的高亮效果

## 5. TaskDetail 页面集成

- [x] 5.1 在 TaskDetail 中集成 WorkflowProgressBar 组件
- [x] 5.2 添加 WorkNodeReviewPanel 的条件渲染逻辑
- [x] 5.3 添加工作流和节点状态的实时订阅
- [x] 5.4 添加任务启动前的工作流模板验证（无模板时阻止执行）
