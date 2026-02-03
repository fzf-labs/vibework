import type { IpcModuleContext } from './types'
import type { NotificationService } from '../services/NotificationService'
import { IPC_CHANNELS } from './channels'

export const registerNotificationIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { notificationService } = services

  handle(
    IPC_CHANNELS.notification.show,
    [
      v.shape({
        title: v.string(),
        body: v.string(),
        icon: v.optional(v.string({ allowEmpty: true })),
        silent: v.optional(v.boolean()),
        urgency: v.optional(v.enum(['normal', 'critical', 'low'] as const))
      })
    ],
    (_, options) => {
      notificationService.showNotification(options as Parameters<NotificationService['showNotification']>[0])
    }
  )

  handle(IPC_CHANNELS.notification.setEnabled, [v.boolean()], (_, enabled) => {
    notificationService.setEnabled(enabled)
  })

  handle(IPC_CHANNELS.notification.isEnabled, [], () => notificationService.isEnabled())

  handle(IPC_CHANNELS.notification.setSoundEnabled, [v.boolean()], (_, enabled) => {
    notificationService.setSoundEnabled(enabled)
  })

  handle(IPC_CHANNELS.notification.isSoundEnabled, [], () => notificationService.isSoundEnabled())

  handle(
    IPC_CHANNELS.notification.setSoundSettings,
    [
      v.shape({
        enabled: v.optional(v.boolean()),
        taskComplete: v.optional(v.boolean()),
        stageComplete: v.optional(v.boolean()),
        error: v.optional(v.boolean())
      })
    ],
    (_, settings) => {
      notificationService.setSoundSettings(settings as Parameters<NotificationService['setSoundSettings']>[0])
    }
  )

  handle(IPC_CHANNELS.notification.getSoundSettings, [], () => notificationService.getSoundSettings())
}
