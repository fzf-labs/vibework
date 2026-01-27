import { useState, useEffect } from 'react'

interface PreviewBrowserProps {
  url: string
  onRefresh?: () => void
}

export function PreviewBrowser({ url, onRefresh }: PreviewBrowserProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    setError('')
  }, [url])

  const handleLoad = () => {
    setLoading(false)
  }

  const handleError = () => {
    setLoading(false)
    setError('加载失败')
  }

  const handleRefresh = () => {
    setLoading(true)
    setError('')
    onRefresh?.()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        <button
          onClick={handleRefresh}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          刷新
        </button>
        <span className="text-sm text-gray-600">{url}</span>
        {loading && <span className="text-sm text-gray-500">加载中...</span>}
      </div>

      <div className="flex-1 relative">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-red-600 mb-2">{error}</div>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                重试
              </button>
            </div>
          </div>
        ) : (
          <webview
            src={url}
            className="w-full h-full"
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>
    </div>
  )
}
