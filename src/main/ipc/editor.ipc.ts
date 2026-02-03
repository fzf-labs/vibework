import type { IpcModuleContext } from './types'

export const registerEditorIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { editorService } = services

  handle('editor:getAvailable', [], () => editorService.getAvailableEditors())

  handle('editor:openProject', [v.string(), v.string()], async (_, projectPath, editorCommand) => {
    await editorService.openProject(projectPath, editorCommand)
  })
}
