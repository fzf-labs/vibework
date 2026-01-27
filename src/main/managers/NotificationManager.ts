import { Notification } from 'electron'
import { EventEmitter } from 'events'
import * as path from 'path'

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

export class NotificationManager extends EventEmitter {
  private enabled: boolean = true
  private soundSettings: SoundSettings = {
    enabled: true,
    taskComplete: true,
    stageComplete: true,
    error: true
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundSettings.enabled = enabled
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

  showNotification(options: NotificationOptions): void {
    if (!this.enabled) {
      return
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

      notification.show()

      notification.on('click', () => {
        this.emit('notification-click', options)
      })
    } catch (error) {
      console.error('Failed to show notification:', error)
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
