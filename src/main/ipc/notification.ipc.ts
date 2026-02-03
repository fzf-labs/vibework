import type { IpcModuleContext } from './types'
import type { NotificationService } from '../services/NotificationService'

export const registerNotificationIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { notificationService } = services

  handle(
    'notification:show',
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

  handle('notification:setEnabled', [v.boolean()], (_, enabled) => {
    notificationService.setEnabled(enabled)
  })

  handle('notification:isEnabled', [], () => notificationService.isEnabled())

  handle('notification:setSoundEnabled', [v.boolean()], (_, enabled) => {
    notificationService.setSoundEnabled(enabled)
  })

  handle('notification:isSoundEnabled', [], () => notificationService.isSoundEnabled())

  handle(
    'notification:setSoundSettings',
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

  handle('notification:getSoundSettings', [], () => notificationService.getSoundSettings())
}
