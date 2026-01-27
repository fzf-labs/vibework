import { useState, useEffect } from 'react'
import { PreviewConfig, PreviewInstance } from '../../types/preview'

interface PreviewControlPanelProps {
  config: PreviewConfig
  onEdit?: () => void
}

export function PreviewControlPanel({ config, onEdit }: PreviewControlPanelProps) {
  const [instance, setInstance] = useState<PreviewInstance | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInstance()
    const interval = setInterval(loadInstance, 2000)
    return () => clearInterval(interval)
  }, [config.id])

  const loadInstance = async () => {
    try {
      const result = await window.api.preview.getInstance(config.id)
      setInstance(result)
    } catch (error) {
      console.error('加载实例失败:', error)
    }
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      await window.api.preview.start(
        config.id,
        config.id,
        config.command,
        config.args,
        config.cwd,
        config.env
      )
      await loadInstance()
    } catch (error: any) {
      alert(`启动失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await window.api.preview.stop(config.id)
      await loadInstance()
    } catch (error: any) {
      alert(`停止失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = async () => {
    await handleStop()
    setTimeout(handleStart, 1000)
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'starting':
        return 'bg-yellow-500'
      case 'stopping':
        return 'bg-orange-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'running':
        return '运行中'
      case 'starting':
        return '启动中'
      case 'stopping':
        return '停止中'
      case 'error':
        return '错误'
      case 'stopped':
        return '已停止'
      default:
        return '未启动'
    }
  }

  const isRunning = instance?.status === 'running'
  const isStopped = !instance || instance.status === 'stopped' || instance.status === 'idle'

  return (
    <div className="p-4 border rounded bg-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{config.name}</h3>
          <p className="text-sm text-gray-600">{config.type === 'frontend' ? '前端项目' : '后端项目'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(instance?.status)}`} />
          <span className="text-sm font-medium">{getStatusText(instance?.status)}</span>
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600">
        <div>命令: {config.command} {config.args.join(' ')}</div>
        {config.port && <div>端口: {config.port}</div>}
        {config.cwd && <div>工作目录: {config.cwd}</div>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleStart}
          disabled={loading || isRunning}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          启动
        </button>
        <button
          onClick={handleStop}
          disabled={loading || isStopped}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          停止
        </button>
        <button
          onClick={handleRestart}
          disabled={loading || isStopped}
          className="px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-50"
        >
          重启
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            编辑配置
          </button>
        )}
      </div>

      {instance?.error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
          错误: {instance.error}
        </div>
      )}

      {config.port && isRunning && (
        <div className="mt-4">
          <a
            href={`http://localhost:${config.port}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline text-sm"
          >
            打开预览 (http://localhost:{config.port})
          </a>
        </div>
      )}
    </div>
  )
}
