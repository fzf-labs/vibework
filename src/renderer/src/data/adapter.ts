// 类型定义
import type {
  CreateSessionInput,
  CreateTaskInput,
  CreateMessageInput,
  CreateFileInput,
  UpdateTaskInput,
  Session,
  Task,
  Message,
  LibraryFile
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

  // ============ File 操作 ============
  createFile: (input: CreateFileInput): Promise<LibraryFile> => {
    return window.api.database.createFile(input) as Promise<LibraryFile>
  },

  getFilesByTaskId: (taskId: string): Promise<LibraryFile[]> => {
    return window.api.database.getFilesByTaskId(taskId) as Promise<LibraryFile[]>
  },

  getAllFiles: (): Promise<LibraryFile[]> => {
    return window.api.database.getAllFiles() as Promise<LibraryFile[]>
  },

  toggleFileFavorite: (fileId: number): Promise<LibraryFile | null> => {
    return window.api.database.toggleFileFavorite(fileId) as Promise<LibraryFile | null>
  },

  deleteFile: (fileId: number): Promise<boolean> => {
    return window.api.database.deleteFile(fileId)
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
        await db.updateTask(taskId, { status: 'completed', cost, duration })
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
