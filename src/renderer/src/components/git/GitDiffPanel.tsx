import { useState } from 'react'
import { GitChangedFilesList } from './GitChangedFilesList'
import { GitDiffViewer } from './GitDiffViewer'

interface ChangedFile {
  path: string
  status: string
  staged: boolean
}

interface GitDiffPanelProps {
  repoPath: string
}

export function GitDiffPanel({ repoPath }: GitDiffPanelProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<ChangedFile | undefined>()

  return (
    <div className="flex h-full">
      <div className="w-80 border-r">
        <GitChangedFilesList
          repoPath={repoPath}
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
        />
      </div>
      <div className="flex-1">
        {selectedFile ? (
          <GitDiffViewer
            repoPath={repoPath}
            filePath={selectedFile.path}
            staged={selectedFile.staged}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            选择一个文件查看变更
          </div>
        )}
      </div>
    </div>
  )
}
