import { useState, useEffect } from 'react'

interface GitDiffViewerProps {
  repoPath: string
  filePath: string
  staged?: boolean
}

export function GitDiffViewer({ repoPath, filePath, staged = false }: GitDiffViewerProps) {
  const [diff, setDiff] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDiff()
  }, [repoPath, filePath, staged])

  const loadDiff = async () => {
    setLoading(true)
    try {
      const result = staged
        ? await window.api.git.getStagedDiff(repoPath, filePath)
        : await window.api.git.getDiff(repoPath, filePath)

      if (result.success) {
        setDiff(result.data)
      }
    } catch (error) {
      console.error('加载diff失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseDiff = (diffText: string) => {
    const lines = diffText.split('\n')
    return lines.map((line, index) => {
      let className = 'font-mono text-sm px-4 py-0.5'

      if (line.startsWith('+') && !line.startsWith('+++')) {
        className += ' bg-green-50 text-green-800'
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        className += ' bg-red-50 text-red-800'
      } else if (line.startsWith('@@')) {
        className += ' bg-blue-50 text-blue-800'
      } else if (line.startsWith('diff') || line.startsWith('index')) {
        className += ' text-gray-500'
      }

      return (
        <div key={index} className={className}>
          {line || ' '}
        </div>
      )
    })
  }

  if (loading) {
    return <div className="p-4">加载中...</div>
  }

  if (!diff) {
    return <div className="p-4 text-gray-500">没有变更</div>
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="min-w-max">
        {parseDiff(diff)}
      </div>
    </div>
  )
}
