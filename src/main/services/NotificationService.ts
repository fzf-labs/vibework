import { app, BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'

interface NotificationOptions {
  title: string
  body: string
  icon?: string
  silent?: boolean
  urgency?: 'normal' | 'critical' | 'low'
  sound?: boolean
  soundType?: 'success' | 'info' | 'error' | 'complete'
}

interface SoundSettings {
  enabled: boolean
  taskComplete: boolean
  stageComplete: boolean
  error: boolean
}

export class NotificationService extends EventEmitter {
  private enabled: boolean = true
  private soundSettings: SoundSettings = {
    enabled: true,
    taskComplete: true,
    stageComplete: true,
    error: true
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    console.info('[NotifyDebug][main] Notification service enabled state updated', { enabled })
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundSettings.enabled = enabled
    console.info('[NotifyDebug][main] Notification sound enabled state updated', { enabled })
  }

  isSoundEnabled(): boolean {
    return this.soundSettings.enabled
  }

  setSoundSettings(settings: Partial<SoundSettings>): void {
    this.soundSettings = { ...this.soundSettings, ...settings }
  }

  getSoundSettings(): SoundSettings {
    return { ...this.soundSettings }
  }

  showNotification(options: NotificationOptions): boolean {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    console.info('[NotifyDebug][main] showNotification called', {
      enabled: this.enabled,
      supported: Notification.isSupported(),
      appFocused: Boolean(focusedWindow),
      focusedWindowVisible: focusedWindow?.isVisible() ?? false,
      appName: app.getName(),
      execPath: process.execPath,
      options
    })
    if (!this.enabled) {
      console.info('[NotifyDebug][main] showNotification skipped because notifications are disabled')
      return false
    }

    if (!Notification.isSupported()) {
      console.info('[NotifyDebug][main] showNotification skipped because Notification API is unsupported')
      return false
    }

    try {
      // 播放声音（如果启用）
      if (options.sound && this.soundSettings.enabled) {
        this.playSound(options.soundType || 'info')
      }

      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        silent: options.silent || false,
        urgency: options.urgency || 'normal'
      })

      notification.on('show', () => {
        console.info('[NotifyDebug][main] Notification show event emitted', {
          title: options.title,
          body: options.body
        })
      })
      notification.on('close', () => {
        console.info('[NotifyDebug][main] Notification close event emitted', {
          title: options.title,
          body: options.body
        })
      })
      notification.show()
      console.info('[NotifyDebug][main] notification.show() invoked')

      notification.on('click', () => {
        console.info('[NotifyDebug][main] Notification click event emitted', {
          title: options.title,
          body: options.body
        })
        this.emit('notification-click', options)
      })
      console.info('[NotifyDebug][main] Notification displayed successfully', {
        title: options.title,
        body: options.body
      })
      return true
    } catch (error) {
      console.error('Failed to show notification:', error)
      console.error('[NotifyDebug][main] Notification display failed', error)
      return false
    }
  }

  private playSound(soundType: string): void {
    // 发送事件到渲染进程播放声音
    this.emit('play-sound', soundType)
  }

  notifyTaskComplete(taskName: string): void {
    this.showNotification({
      title: '任务完成',
      body: `任务 "${taskName}" 已完成`,
      urgency: 'normal',
      sound: this.soundSettings.taskComplete,
      soundType: 'complete'
    })
  }

  notifyStageComplete(stageName: string): void {
    this.showNotification({
      title: '环节完成',
      body: `环节 "${stageName}" 已完成`,
      urgency: 'low',
      sound: this.soundSettings.stageComplete,
      soundType: 'success'
    })
  }

  notifyError(message: string): void {
    this.showNotification({
      title: '错误',
      body: message,
      urgency: 'critical',
      sound: this.soundSettings.error,
      soundType: 'error'
    })
  }
}
