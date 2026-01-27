import { useState, useEffect, useCallback } from 'react'

interface GitConflictViewerProps {
  repoPath: string
  filePath: string
  onResolve?: () => void
}

export function GitConflictViewer({
  repoPath,
  filePath,
  onResolve
}: GitConflictViewerProps): JSX.Element {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const loadConflictContent = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.git.getConflictContent(repoPath, filePath)
      if (result.success) {
        setContent(result.data)
      }
    } catch (error) {
      console.error('加载冲突内容失败:', error)
    } finally {
      setLoading(false)
    }
  }, [filePath, repoPath])

  useEffect(() => {
    loadConflictContent()
  }, [loadConflictContent])

  const handleResolve = async (strategy: 'ours' | 'theirs'): Promise<void> => {
    try {
      const result = await window.api.git.resolveConflict(repoPath, filePath, strategy)
      if (result.success) {
        alert(`已使用${strategy === 'ours' ? '当前分支' : '目标分支'}的版本解决冲突`)
        onResolve?.()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      alert(`解决冲突失败: ${message}`)
    }
  }

  const parseConflictContent = (text: string): Array<{ type: string; content: string }> => {
    const lines = text.split('\n')
    const parsed: Array<{ type: string; content: string }> = []
    let currentSection: 'ours' | 'theirs' | 'normal' = 'normal'

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        currentSection = 'ours'
        parsed.push({ type: 'marker', content: line })
      } else if (line.startsWith('=======')) {
        currentSection = 'theirs'
        parsed.push({ type: 'marker', content: line })
      } else if (line.startsWith('>>>>>>>')) {
        currentSection = 'normal'
        parsed.push({ type: 'marker', content: line })
      } else {
        parsed.push({ type: currentSection, content: line })
      }
    }

    return parsed
  }

  if (loading) {
    return <div className="p-4">加载中...</div>
  }

  const parsedContent = parseConflictContent(content)

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-2 border-b bg-gray-50">
        <button
          onClick={() => handleResolve('ours')}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          使用当前分支版本
        </button>
        <button
          onClick={() => handleResolve('theirs')}
          className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
        >
          使用目标分支版本
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <div className="font-mono text-sm">
          {parsedContent.map((line, index) => {
            let className = 'px-4 py-0.5'

            if (line.type === 'marker') {
              className += ' bg-gray-200 text-gray-700 font-bold'
            } else if (line.type === 'ours') {
              className += ' bg-blue-50 text-blue-800'
            } else if (line.type === 'theirs') {
              className += ' bg-green-50 text-green-800'
            }

            return (
              <div key={index} className={className}>
                {line.content || ' '}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
