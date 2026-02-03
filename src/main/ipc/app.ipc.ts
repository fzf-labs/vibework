import { app } from 'electron'
import type { IpcModuleContext } from './types'

export const registerAppIpc = ({ handle }: IpcModuleContext): void => {
  handle('app:getVersion', [], () => app.getVersion())
}
