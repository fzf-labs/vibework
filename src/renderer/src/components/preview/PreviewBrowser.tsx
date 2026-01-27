import { useState, useEffect, useRef, useCallback } from 'react'

interface PreviewBrowserProps {
  url: string
  onRefresh?: () => void
}

export function PreviewBrowser({ url, onRefresh }: PreviewBrowserProps): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const webviewRef = useRef<Electron.WebviewTag | null>(null)

  useEffect(() => {
    const reset = setTimeout(() => {
      setLoading(true)
      setError('')
    }, 0)
    return () => clearTimeout(reset)
  }, [url])

  const handleLoad = useCallback((): void => {
    setLoading(false)
  }, [])

  const handleError = useCallback((): void => {
    setLoading(false)
    setError('加载失败')
  }, [])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    webview.addEventListener('did-finish-load', handleLoad)
    webview.addEventListener('did-fail-load', handleError)

    return () => {
      webview.removeEventListener('did-finish-load', handleLoad)
      webview.removeEventListener('did-fail-load', handleError)
    }
  }, [handleError, handleLoad])

  const handleRefresh = (): void => {
    setLoading(true)
    setError('')
    webviewRef.current?.reload()
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
              <button onClick={handleRefresh} className="px-4 py-2 bg-blue-500 text-white rounded">
                重试
              </button>
            </div>
          </div>
        ) : (
          <webview ref={webviewRef} src={url} className="w-full h-full" />
        )}
      </div>
    </div>
  )
}
