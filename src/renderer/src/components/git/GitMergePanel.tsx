import { useState, useEffect, useCallback } from 'react'

interface GitMergePanelProps {
  repoPath: string
  onMergeComplete?: () => void
}

export function GitMergePanel({ repoPath, onMergeComplete }: GitMergePanelProps): JSX.Element {
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [merging, setMerging] = useState(false)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [error, setError] = useState<string>('')

  const loadBranches = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.git.getBranches?.(repoPath)
      if (result?.success) {
        setBranches(result.data || [])
      }
    } catch (error) {
      console.error('加载分支失败:', error)
    }
  }, [repoPath])

  useEffect(() => {
    loadBranches()
  }, [loadBranches])

  const handleMerge = async (): Promise<void> => {
    if (!selectedBranch) return

    setMerging(true)
    setError('')
    setConflicts([])

    try {
      const result = await window.api.git.mergeBranch(repoPath, selectedBranch)

      if (result.success && result.data.success) {
        alert('合并成功!')
        onMergeComplete?.()
      } else if (result.data.conflicts) {
        setConflicts(result.data.conflicts)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '合并失败')
    } finally {
      setMerging(false)
    }
  }

  const handleAbortMerge = async (): Promise<void> => {
    try {
      const result = await window.api.git.abortMerge(repoPath)
      if (result.success) {
        setConflicts([])
        alert('已中止合并')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '中止合并失败')
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">合并分支</h2>

      {conflicts.length === 0 ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">选择要合并的分支</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              disabled={merging}
            >
              <option value="">请选择分支</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleMerge}
            disabled={!selectedBranch || merging}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {merging ? '合并中...' : '开始合并'}
          </button>

          {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-semibold text-yellow-800 mb-2">检测到合并冲突</h3>
            <p className="text-sm text-yellow-700 mb-3">以下文件存在冲突,请解决后继续:</p>
            <ul className="space-y-1">
              {conflicts.map((file) => (
                <li key={file} className="text-sm font-mono text-yellow-800">
                  {file}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <button onClick={handleAbortMerge} className="px-4 py-2 bg-red-500 text-white rounded">
              中止合并
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
