import type { IpcModuleContext } from './types'
import type { TaskService } from '../services/TaskService'

export const registerTaskIpc = ({ handle, v, services, taskStatusValues }: IpcModuleContext): void => {
  const { taskService } = services

  handle(
    'task:create',
    [
      v.shape({
        title: v.string(),
        prompt: v.string(),
        projectId: v.optional(v.string()),
        projectPath: v.optional(v.string()),
        createWorktree: v.optional(v.boolean()),
        baseBranch: v.optional(v.string()),
        worktreeBranchPrefix: v.optional(v.string()),
        worktreeRootPath: v.optional(v.string()),
        cliToolId: v.optional(v.string()),
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

  handle('task:get', [v.string()], (_, id) => taskService.getTask(id))

  handle('task:getAll', [], () => taskService.getAllTasks())

  handle('task:getByProject', [v.string()], (_, projectId) => taskService.getTasksByProjectId(projectId))

  handle('task:updateStatus', [v.string(), v.enum(taskStatusValues)], (_, id, status) =>
    taskService.updateTaskStatus(id, status)
  )

  handle('task:delete', [v.string(), v.optional(v.boolean())], async (_, id, removeWorktree) => {
    return await taskService.deleteTask(id, removeWorktree)
  })
}
