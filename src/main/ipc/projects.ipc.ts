import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerProjectsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { projectService } = services

  handle(IPC_CHANNELS.projects.getAll, [], () => projectService.getAllProjects())

  handle(IPC_CHANNELS.projects.get, [v.string()], (_, id) => projectService.getProject(id))

  handle(
    IPC_CHANNELS.projects.add,
    [
      v.shape({
        name: v.string(),
        path: v.string(),
        description: v.optional(v.string({ allowEmpty: true })),
        projectType: v.optional(v.enum(['normal', 'git'] as const))
      })
    ],
    (_, project) => {
      try {
        const result = projectService.addProject(project as any)
        return { success: true, data: result }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  handle(
    IPC_CHANNELS.projects.update,
    [
      v.string(),
      v.shape({
        name: v.optional(v.string()),
        description: v.optional(v.string({ allowEmpty: true })),
        projectType: v.optional(v.enum(['normal', 'git'] as const))
      })
    ],
    (_, id, updates) => projectService.updateProject(id, updates as any)
  )

  handle(IPC_CHANNELS.projects.delete, [v.string()], (_, id) => projectService.deleteProject(id))

  handle(IPC_CHANNELS.projects.checkPath, [v.string()], (_, id) =>
    projectService.checkProjectPath(id)
  )
}
