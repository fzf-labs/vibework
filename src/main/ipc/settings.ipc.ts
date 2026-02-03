import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerSettingsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { settingsService } = services

  handle(IPC_CHANNELS.settings.get, [], () =>
    settingsService.getSettings() as unknown as Record<string, unknown>
  )
  handle(IPC_CHANNELS.settings.update, [v.object()], (_, updates) =>
    settingsService.updateSettings(updates) as unknown as Record<string, unknown>
  )
  handle(IPC_CHANNELS.settings.reset, [], () =>
    settingsService.resetSettings() as unknown as Record<string, unknown>
  )
}
