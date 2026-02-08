import type { IpcModuleContext } from './types'
import type { TaskService } from '../services/TaskService'
import type { TaskStatus } from '../types/task'
import { IPC_CHANNELS } from './channels'

export const registerTaskIpc = ({ handle, v, services, taskStatusValues }: IpcModuleContext): void => {
  const { taskService, databaseService } = services

  handle(
    IPC_CHANNELS.task.create,
    [
      v.shape({
        title: v.string(),
        prompt: v.string(),
        taskMode: v.enum(['conversation', 'workflow']),
        projectId: v.optional(v.string()),
        projectPath: v.optional(v.string()),
        createWorktree: v.optional(v.boolean()),
        baseBranch: v.optional(v.string()),
        worktreeBranchPrefix: v.optional(v.string()),
        worktreeRootPath: v.optional(v.string()),
        cliToolId: v.optional(v.string()),
        agentToolConfigId: v.optional(v.string()),
        workflowTemplateId: v.optional(v.string())
      })
    ],
    async (_, options) => {
      try {
        const task = await taskService.createTask(options as Parameters<TaskService['createTask']>[0])
        return { success: true, data: task }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  handle(IPC_CHANNELS.task.get, [v.string()], (_, id) => taskService.getTask(id))

  handle(IPC_CHANNELS.task.getAll, [], () => taskService.getAllTasks())

  handle(IPC_CHANNELS.task.getByProject, [v.string()], (_, projectId) =>
    taskService.getTasksByProjectId(projectId)
  )

  handle(IPC_CHANNELS.task.updateStatus, [v.string(), v.enum(taskStatusValues)], (_, id, status) =>
    taskService.updateTaskStatus(id, status as TaskStatus)
  )

  handle(IPC_CHANNELS.task.delete, [v.string(), v.optional(v.boolean())], async (_, id, removeWorktree) => {
    return await taskService.deleteTask(id, removeWorktree)
  })

  handle(IPC_CHANNELS.task.startExecution, [v.string()], (_, taskId) => {
    return databaseService.startTaskExecution(taskId)
  })

  handle(IPC_CHANNELS.task.stopExecution, [v.string()], (_, taskId) => {
    return databaseService.stopTaskExecution(taskId)
  })
}
