import { useRef } from 'react'
import { configManager } from '../../utils/configManager'

export function ConfigImportExport(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = (): void => {
    try {
      configManager.downloadConfig()
      alert('配置导出成功')
    } catch (error) {
      alert(`配置导出失败: ${String(error)}`)
    }
  }

  const handleImportClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = await configManager.uploadConfig(file)
    alert(result.message)

    // 清空文件选择
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">配置管理</h3>
        <p className="text-sm text-gray-500 mb-4">导出或导入应用配置，包括流水线模板、通知设置等</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          导出配置
        </button>
        <button
          onClick={handleImportClick}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          导入配置
        </button>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
