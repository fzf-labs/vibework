// 类型定义
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

  updateTask: (id: string, updates: UpdateTaskInput): Promise<Task | null> => {
    return window.api.database.updateTask(id, updates) as Promise<Task | null>
  },

  deleteTask: (id: string): Promise<boolean> => {
    return window.api.database.deleteTask(id)
  },

  getTasksBySessionId: (sessionId: string): Promise<Task[]> => {
    return window.api.database.getTasksBySessionId(sessionId) as Promise<Task[]>
  },

  // ============ Pipeline Template 操作 ============
  getPipelineTemplatesByProject: (projectId: string): Promise<unknown[]> => {
    return window.api.database.getPipelineTemplatesByProject(projectId) as Promise<unknown[]>
  },

  getGlobalPipelineTemplates: (): Promise<unknown[]> => {
    return window.api.database.getGlobalPipelineTemplates() as Promise<unknown[]>
  },

  getPipelineTemplate: (templateId: string): Promise<unknown> => {
    return window.api.database.getPipelineTemplate(templateId) as Promise<unknown>
  },

  createPipelineTemplate: (input: unknown): Promise<unknown> => {
    return window.api.database.createPipelineTemplate(input) as Promise<unknown>
  },

  updatePipelineTemplate: (input: unknown): Promise<unknown> => {
    return window.api.database.updatePipelineTemplate(input) as Promise<unknown>
  },

  deletePipelineTemplate: (templateId: string, scope: string): Promise<boolean> => {
    return window.api.database.deletePipelineTemplate(templateId, scope) as Promise<boolean>
  },

  createProjectTemplateFromGlobal: (
    globalTemplateId: string,
    projectId: string
  ): Promise<unknown> => {
    return window.api.database.createProjectTemplateFromGlobal(
      globalTemplateId,
      projectId
    ) as Promise<unknown>
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
    const task = await db.getTask(taskId)
    const isPipelineTask = Boolean(task?.pipeline_template_id)

    if (messageType === 'result') {
      if (subtype === 'success') {
        if (isPipelineTask) {
          await db.updateTask(taskId, { status: 'in_review', cost, duration })
        } else {
          await db.updateTask(taskId, { status: 'completed', cost, duration })
        }
      } else if (subtype === 'error_max_turns') {
        await db.updateTask(taskId, { cost, duration })
      } else {
        await db.updateTask(taskId, { status: 'error', cost, duration })
      }
    } else if (messageType === 'error') {
      await db.updateTask(taskId, { status: 'error' })
    }
  }
}
