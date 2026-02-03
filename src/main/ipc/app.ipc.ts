import { app } from 'electron'
import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerAppIpc = ({ handle }: IpcModuleContext): void => {
  handle(IPC_CHANNELS.app.getVersion, [], () => app.getVersion())
}
