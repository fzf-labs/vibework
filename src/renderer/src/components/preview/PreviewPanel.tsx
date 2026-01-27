import { useState } from 'react'
import { PreviewConfig } from '../../types/preview'
import { PreviewControlPanel } from './PreviewControlPanel'
import { PreviewLogViewer } from './PreviewLogViewer'
import { PreviewBrowser } from './PreviewBrowser'

interface PreviewPanelProps {
  config: PreviewConfig
  onEdit?: () => void
}

export function PreviewPanel({ config, onEdit }: PreviewPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<'logs' | 'browser'>('logs')

  const previewUrl = config.port ? `http://localhost:${config.port}` : ''

  return (
    <div className="flex flex-col h-full">
      <PreviewControlPanel config={config} onEdit={onEdit} />

      <div className="flex-1 flex flex-col overflow-hidden mt-4">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 ${
              activeTab === 'logs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'
            }`}
          >
            日志输出
          </button>
          {config.type === 'frontend' && previewUrl && (
            <button
              onClick={() => setActiveTab('browser')}
              className={`px-4 py-2 ${
                activeTab === 'browser'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600'
              }`}
            >
              浏览器预览
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'logs' && <PreviewLogViewer instanceId={config.id} />}
          {activeTab === 'browser' && previewUrl && <PreviewBrowser url={previewUrl} />}
        </div>
      </div>
    </div>
  )
}
