/**
 * 通知工具函数
 */

import { soundManager } from './soundManager'
import { notificationStore } from '../stores/notificationStore'

export const notification = {
  /**
   * 显示成功通知
   */
  success: async (title: string, body: string) => {
    // 添加到应用内通知中心
    notificationStore.add({ title, body, type: 'success' })

    const soundEnabled = await window.api.notification.isSoundEnabled()
    if (soundEnabled) {
      await soundManager.play('success')
    }
    await window.api.notification.show({
      title,
      body,
      urgency: 'low'
    })
  },

  /**
   * 显示信息通知
   */
  info: async (title: string, body: string) => {
    // 添加到应用内通知中心
    notificationStore.add({ title, body, type: 'info' })

    const soundEnabled = await window.api.notification.isSoundEnabled()
    if (soundEnabled) {
      await soundManager.play('info')
    }
    await window.api.notification.show({
      title,
      body,
      urgency: 'normal'
    })
  },

  /**
   * 显示错误通知
   */
  error: async (title: string, body: string) => {
    // 添加到应用内通知中心
    notificationStore.add({ title, body, type: 'error' })

    const soundSettings = await window.api.notification.getSoundSettings()
    if (soundSettings.enabled && soundSettings.error) {
      await soundManager.play('error')
    }
    await window.api.notification.show({
      title,
      body,
      urgency: 'critical'
    })
  },

  /**
   * 任务完成通知
   */
  taskComplete: async (taskName: string) => {
    const title = '任务完成'
    const body = `任务 "${taskName}" 已完成`

    // 添加到应用内通知中心
    notificationStore.add({ title, body, type: 'success' })

    const soundSettings = await window.api.notification.getSoundSettings()
    if (soundSettings.enabled && soundSettings.taskComplete) {
      await soundManager.play('complete')
    }
    await window.api.notification.show({
      title,
      body,
      urgency: 'normal'
    })
  },

  /**
   * 环节完成通知
   */
  stageComplete: async (stageName: string) => {
    const title = '环节完成'
    const body = `环节 "${stageName}" 已完成`

    // 添加到应用内通知中心
    notificationStore.add({ title, body, type: 'info' })

    const soundSettings = await window.api.notification.getSoundSettings()
    if (soundSettings.enabled && soundSettings.stageComplete) {
      await soundManager.play('success')
    }
    await window.api.notification.show({
      title,
      body,
      urgency: 'low'
    })
  },

  /**
   * 流水线完成通知
   */
  pipelineComplete: async (pipelineName: string) => {
    const title = '流水线完成'
    const body = `流水线 "${pipelineName}" 已完成`

    // 添加到应用内通知中心
    notificationStore.add({ title, body, type: 'success' })

    const soundSettings = await window.api.notification.getSoundSettings()
    if (soundSettings.enabled && soundSettings.taskComplete) {
      await soundManager.play('complete')
    }
    await window.api.notification.show({
      title,
      body,
      urgency: 'normal'
    })
  }
}
