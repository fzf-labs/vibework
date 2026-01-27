import { pipelineTemplateStore } from '../stores/pipelineTemplateStore'
import type { PipelineTemplate } from '../types/pipeline'

interface NotificationSettings {
  enabled?: boolean
  taskComplete?: boolean
  stageComplete?: boolean
  error?: boolean
}

interface ExportConfig {
  version: string
  exportDate: number
  pipelineTemplates: PipelineTemplate[]
  notificationSettings?: NotificationSettings
}

export const configManager = {
  /**
   * 导出所有配置
   */
  exportConfig: (): ExportConfig => {
    const config: ExportConfig = {
      version: '1.0.0',
      exportDate: Date.now(),
      pipelineTemplates: pipelineTemplateStore.getAll()
    }

    // 导出通知设置
    try {
      const notificationSettings = localStorage.getItem('notificationSettings')
      if (notificationSettings) {
        config.notificationSettings = JSON.parse(notificationSettings) as NotificationSettings
      }
    } catch (error) {
      console.error('Failed to export notification settings:', error)
    }

    return config
  },

  /**
   * 导入配置
   */
  importConfig: (config: ExportConfig): { success: boolean; message: string } => {
    try {
      // 导入流水线模板
      if (config.pipelineTemplates && Array.isArray(config.pipelineTemplates)) {
        config.pipelineTemplates.forEach((template) => {
          pipelineTemplateStore.add({
            name: template.name,
            description: template.description,
            stages: template.stages
          })
        })
      }

      // 导入通知设置
      if (config.notificationSettings) {
        localStorage.setItem('notificationSettings', JSON.stringify(config.notificationSettings))
      }

      return { success: true, message: '配置导入成功' }
    } catch (error) {
      return { success: false, message: `配置导入失败: ${String(error)}` }
    }
  },

  /**
   * 下载配置文件
   */
  downloadConfig: (): void => {
    const config = configManager.exportConfig()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vibework-config-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  /**
   * 从文件上传导入配置
   */
  uploadConfig: (file: File): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string)
          const result = configManager.importConfig(config)
          resolve(result)
        } catch (error) {
          resolve({ success: false, message: `文件解析失败: ${error}` })
        }
      }
      reader.onerror = () => {
        resolve({ success: false, message: '文件读取失败' })
      }
      reader.readAsText(file)
    })
  }
}
