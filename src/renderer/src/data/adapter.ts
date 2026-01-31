// 类型定义
import { notifyTaskCompleted } from '@/lib/notifications'
import type {
  CreateSessionInput,
  CreateTaskInput,
  CreateMessageInput,
  UpdateTaskInput,
  Session,
  Task,
  Message
} from './types'

// 导出统一的数据库 API（通过 IPC 调用 Main 进程）
export const db = {
  // ============ Session 操作 ============
  createSession: (input: CreateSessionInput): Promise<Session> => {
    return window.api.database.createSession(input) as Promise<Session>
  },

  getSession: (id: string): Promise<Session | null> => {
    return window.api.database.getSession(id) as Promise<Session | null>
  },

  getAllSessions: (): Promise<Session[]> => {
    return window.api.database.getAllSessions() as Promise<Session[]>
  },

  updateSessionTaskCount: (sessionId: string, count: number): Promise<void> => {
    return window.api.database.updateSessionTaskCount(sessionId, count)
  },

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

    return updatedTask
  },

  deleteTask: (id: string): Promise<boolean> => {
    return window.api.database.deleteTask(id)
  },

  getTasksBySessionId: (sessionId: string): Promise<Task[]> => {
    return window.api.database.getTasksBySessionId(sessionId) as Promise<Task[]>
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
  createWorkflow: (taskId: string, templateId: string, scope: string): Promise<unknown> => {
    return window.api.database.createWorkflow(taskId, templateId, scope) as Promise<unknown>
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

  // ============ Message 操作 ============
  createMessage: (input: CreateMessageInput): Promise<Message> => {
    return window.api.database.createMessage(input) as Promise<Message>
  },

  getMessagesByTaskId: (taskId: string): Promise<Message[]> => {
    return window.api.database.getMessagesByTaskId(taskId) as Promise<Message[]>
  },

  deleteMessagesByTaskId: (taskId: string): Promise<number> => {
    return window.api.database.deleteMessagesByTaskId(taskId)
  },

  // ============ 辅助函数 ============
  updateTaskFromMessage: async (
    taskId: string,
    messageType: string,
    subtype?: string,
    cost?: number,
    duration?: number
  ): Promise<void> => {
    if (messageType === 'result') {
      if (subtype === 'success') {
        await db.updateTask(taskId, { status: 'in_review', cost, duration })
      } else if (subtype === 'error_max_turns') {
        await db.updateTask(taskId, { cost, duration })
      } else {
        await db.updateTask(taskId, { cost, duration })
      }
    } else if (messageType === 'error') {
      await db.updateTask(taskId, { cost, duration })
    }
  }
}
