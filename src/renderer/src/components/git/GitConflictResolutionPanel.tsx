import { useState, useEffect } from 'react'
import { GitConflictViewer } from './GitConflictViewer'

interface GitConflictResolutionPanelProps {
  repoPath: string
  onAllResolved?: () => void
}

export function GitConflictResolutionPanel({ repoPath, onAllResolved }: GitConflictResolutionPanelProps) {
  const [conflictFiles, setConflictFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadConflictFiles()
  }, [repoPath])

  const loadConflictFiles = async () => {
    setLoading(true)
    try {
      const result = await window.api.git.getConflictFiles(repoPath)
      if (result.success) {
        const files = result.data || []
        setConflictFiles(files)
        if (files.length > 0 && !selectedFile) {
          setSelectedFile(files[0])
        }
        if (files.length === 0) {
          onAllResolved?.()
        }
      }
    } catch (error) {
      console.error('加载冲突文件失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileResolve = () => {
    loadConflictFiles()
  }

  if (loading) {
    return <div className="p-4">加载中...</div>
  }

  if (conflictFiles.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-green-600 font-semibold mb-2">
          所有冲突已解决
        </div>
        <p className="text-sm text-gray-600">
          可以继续提交变更
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-64 border-r bg-gray-50">
        <div className="p-3 border-b bg-yellow-50">
          <h3 className="font-semibold text-yellow-800">
            冲突文件 ({conflictFiles.length})
          </h3>
        </div>
        <div className="overflow-auto">
          {conflictFiles.map(file => (
            <div
              key={file}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                selectedFile === file ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
              onClick={() => setSelectedFile(file)}
            >
              <div className="text-sm font-mono truncate">{file}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {selectedFile ? (
          <GitConflictViewer
            repoPath={repoPath}
            filePath={selectedFile}
            onResolve={handleFileResolve}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            选择一个冲突文件
          </div>
        )}
      </div>
    </div>
  )
}
