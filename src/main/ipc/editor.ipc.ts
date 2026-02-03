import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerEditorIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { editorService } = services

  handle(IPC_CHANNELS.editor.getAvailable, [], () => editorService.getAvailableEditors())

  handle(
    IPC_CHANNELS.editor.openProject,
    [v.string(), v.string()],
    async (_, projectPath, editorCommand) => {
    await editorService.openProject(projectPath, editorCommand)
  })
}
