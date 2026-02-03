import type { IpcModuleContext } from './types'

export const registerSettingsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { settingsService } = services

  handle('settings:get', [], () => settingsService.getSettings())
  handle('settings:update', [v.object()], (_, updates) => settingsService.updateSettings(updates))
  handle('settings:reset', [], () => settingsService.resetSettings())
}
