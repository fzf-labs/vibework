// 类型定义
import { notifyTaskCompleted, playTaskReviewSound } from '@/lib/notifications'
import type {
  CreateTaskInput,
  UpdateTaskInput,
  Task
} from './types'

// 导出统一的数据库 API（通过 IPC 调用 Main 进程）
export const db = {
  // ============ Task 操作 ============
  createTask: (input: CreateTaskInput): Promise<Task> => {
    return window.api.database.createTask(input) as Promise<Task>
  },

  getTask: (id: string): Promise<Task | null> => {
    return window.api.database.getTask(id) as Promise<Task | null>
  },

  getAllTasks: (): Promise<Task[]> => {
    return window.api.database.getAllTasks() as Promise<Task[]>
  },

  updateTask: async (id: string, updates: UpdateTaskInput): Promise<Task | null> => {
    const updatedTask =
      (await window.api.database.updateTask(id, updates)) as Task | null

    if (updates.status === 'done' && updatedTask?.status === 'done') {
      const taskTitle = updatedTask.title || updatedTask.prompt || undefined
      void notifyTaskCompleted(taskTitle)
    }

    if (updates.status === 'in_review' && updatedTask?.status === 'in_review') {
      void playTaskReviewSound()
    }

    return updatedTask
  },

  deleteTask: (id: string): Promise<boolean> => {
    return window.api.database.deleteTask(id)
  },

  // ============ Workflow Template 操作 ============
  getGlobalWorkflowTemplates: (): Promise<unknown[]> => {
    return window.api.database.getGlobalWorkflowTemplates() as Promise<unknown[]>
  },

  getWorkflowTemplatesByProject: (projectId: string): Promise<unknown[]> => {
    return window.api.database.getWorkflowTemplatesByProject(projectId) as Promise<unknown[]>
  },

  getWorkflowTemplate: (templateId: string): Promise<unknown> => {
    return window.api.database.getWorkflowTemplate(templateId) as Promise<unknown>
  },

  createWorkflowTemplate: (input: unknown): Promise<unknown> => {
    return window.api.database.createWorkflowTemplate(input) as Promise<unknown>
  },

  updateWorkflowTemplate: (input: unknown): Promise<unknown> => {
    return window.api.database.updateWorkflowTemplate(input) as Promise<unknown>
  },

  deleteWorkflowTemplate: (templateId: string, scope: string): Promise<boolean> => {
    return window.api.database.deleteWorkflowTemplate(templateId, scope) as Promise<boolean>
  },

  copyGlobalWorkflowToProject: (globalTemplateId: string, projectId: string): Promise<unknown> => {
    return window.api.database.copyGlobalWorkflowToProject(globalTemplateId, projectId) as Promise<unknown>
  },

  // ============ Workflow 实例操作 ============
  createWorkflow: (taskId: string): Promise<unknown> => {
    return window.api.database.createWorkflow(taskId) as Promise<unknown>
  },

  getWorkflow: (id: string): Promise<unknown> => {
    return window.api.database.getWorkflow(id) as Promise<unknown>
  },

  getWorkflowByTaskId: (taskId: string): Promise<unknown> => {
    return window.api.database.getWorkflowByTaskId(taskId) as Promise<unknown>
  },

  updateWorkflowStatus: (id: string, status: string, nodeIndex?: number): Promise<unknown> => {
    return window.api.database.updateWorkflowStatus(id, status, nodeIndex) as Promise<unknown>
  },

  // ============ WorkNode 实例操作 ============
  createWorkNode: (workflowId: string, templateId: string, nodeOrder: number): Promise<unknown> => {
    return window.api.database.createWorkNode(workflowId, templateId, nodeOrder) as Promise<unknown>
  },

  getWorkNodesByWorkflowId: (workflowId: string): Promise<unknown[]> => {
    return window.api.database.getWorkNodesByWorkflowId(workflowId) as Promise<unknown[]>
  },

  updateWorkNodeStatus: async (id: string, status: string): Promise<unknown> => {
    const updatedNode =
      (await window.api.database.updateWorkNodeStatus(id, status)) as unknown

    return updatedNode
  },

  approveWorkNode: (id: string): Promise<void> => {
    return window.api.database.approveWorkNode(id) as Promise<void>
  },

  rejectWorkNode: (id: string): Promise<void> => {
    return window.api.database.rejectWorkNode(id) as Promise<void>
  },

  // ============ AgentExecution 操作 ============
  createAgentExecution: (workNodeId: string): Promise<unknown> => {
    return window.api.database.createAgentExecution(workNodeId) as Promise<unknown>
  },

  getAgentExecutionsByWorkNodeId: (workNodeId: string): Promise<unknown[]> => {
    return window.api.database.getAgentExecutionsByWorkNodeId(workNodeId) as Promise<unknown[]>
  },

  getLatestAgentExecution: (workNodeId: string): Promise<unknown> => {
    return window.api.database.getLatestAgentExecution(workNodeId) as Promise<unknown>
  },

  updateAgentExecutionStatus: (id: string, status: string, cost?: number, duration?: number): Promise<unknown> => {
    return window.api.database.updateAgentExecutionStatus(id, status, cost, duration) as Promise<unknown>
  },

  // ============ 辅助函数 ============
}
