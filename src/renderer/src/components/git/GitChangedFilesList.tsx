import { useState, useEffect } from 'react'
import { Checkbox } from '../common/Checkbox'

interface ChangedFile {
  path: string
  status: string
  staged: boolean
}

interface GitChangedFilesListProps {
  repoPath: string
  onFileSelect: (file: ChangedFile) => void
  selectedFile?: ChangedFile
}

export function GitChangedFilesList({ repoPath, onFileSelect, selectedFile }: GitChangedFilesListProps) {
  const [files, setFiles] = useState<ChangedFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadChangedFiles()
  }, [repoPath])

  const loadChangedFiles = async () => {
    setLoading(true)
    try {
      const result = await window.api.git.getChangedFiles(repoPath)
      if (result.success) {
        setFiles(result.data)
      }
    } catch (error) {
      console.error('加载变更文件失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStageFiles = async () => {
    const filesToStage = Array.from(selectedFiles)
    try {
      const result = await window.api.git.stageFiles(repoPath, filesToStage)
      if (result.success) {
        setSelectedFiles(new Set())
        loadChangedFiles()
      }
    } catch (error) {
      console.error('暂存文件失败:', error)
    }
  }

  const handleUnstageFiles = async () => {
    const filesToUnstage = Array.from(selectedFiles)
    try {
      const result = await window.api.git.unstageFiles(repoPath, filesToUnstage)
      if (result.success) {
        setSelectedFiles(new Set())
        loadChangedFiles()
      }
    } catch (error) {
      console.error('取消暂存失败:', error)
    }
  }

  const toggleFileSelection = (filePath: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath)
    } else {
      newSelection.add(filePath)
    }
    setSelectedFiles(newSelection)
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'M ': '已修改',
      ' M': '已修改',
      'A ': '新增',
      'D ': '删除',
      'R ': '重命名',
      '??': '未跟踪'
    }
    return statusMap[status] || status
  }

  const unstagedFiles = files.filter(f => !f.staged)
  const stagedFiles = files.filter(f => f.staged)

  if (loading) {
    return <div className="p-4">加载中...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-2 border-b">
        <button
          onClick={handleStageFiles}
          disabled={selectedFiles.size === 0}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded disabled:opacity-50"
        >
          暂存
        </button>
        <button
          onClick={handleUnstageFiles}
          disabled={selectedFiles.size === 0}
          className="px-3 py-1 text-sm bg-gray-500 text-white rounded disabled:opacity-50"
        >
          取消暂存
        </button>
        <button
          onClick={loadChangedFiles}
          className="px-3 py-1 text-sm bg-gray-200 rounded"
        >
          刷新
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {stagedFiles.length > 0 && (
          <div className="mb-4">
            <div className="px-4 py-2 bg-gray-100 font-semibold text-sm">
              已暂存的变更 ({stagedFiles.length})
            </div>
            {stagedFiles.map(file => (
              <div
                key={file.path}
                className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer ${
                  selectedFile?.path === file.path ? 'bg-blue-50' : ''
                }`}
                onClick={() => onFileSelect(file)}
              >
                <Checkbox
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-green-600 font-mono w-16">
                  {getStatusLabel(file.status)}
                </span>
                <span className="flex-1 text-sm truncate">{file.path}</span>
              </div>
            ))}
          </div>
        )}

        {unstagedFiles.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-gray-100 font-semibold text-sm">
              未暂存的变更 ({unstagedFiles.length})
            </div>
            {unstagedFiles.map(file => (
              <div
                key={file.path}
                className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer ${
                  selectedFile?.path === file.path ? 'bg-blue-50' : ''
                }`}
                onClick={() => onFileSelect(file)}
              >
                <Checkbox
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-orange-600 font-mono w-16">
                  {getStatusLabel(file.status)}
                </span>
                <span className="flex-1 text-sm truncate">{file.path}</span>
              </div>
            ))}
          </div>
        )}

        {files.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            没有变更文件
          </div>
        )}
      </div>
    </div>
  )
}
