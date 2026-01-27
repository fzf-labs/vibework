import { useState, useEffect, useCallback } from 'react'
import { GitConflictResolutionPanel } from './GitConflictResolutionPanel'

interface GitRebasePanelProps {
  repoPath: string
  onRebaseComplete?: () => void
}

export function GitRebasePanel({ repoPath, onRebaseComplete }: GitRebasePanelProps): JSX.Element {
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [rebasing, setRebasing] = useState(false)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [error, setError] = useState<string>('')
  const [inProgress, setInProgress] = useState(false)

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

  const handleRebase = async (): Promise<void> => {
    if (!selectedBranch) return

    setRebasing(true)
    setError('')
    setConflicts([])

    try {
      const result = await window.api.git.rebaseBranch(repoPath, selectedBranch)

      if (result.success && result.data.success) {
        alert('Rebase成功!')
        onRebaseComplete?.()
      } else if (result.data.conflicts) {
        setConflicts(result.data.conflicts)
        setInProgress(true)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Rebase失败')
    } finally {
      setRebasing(false)
    }
  }

  const handleContinue = async (): Promise<void> => {
    setRebasing(true)
    setError('')

    try {
      const result = await window.api.git.rebaseContinue(repoPath)

      if (result.success && result.data.success) {
        alert('Rebase继续成功!')
        setInProgress(false)
        setConflicts([])
        onRebaseComplete?.()
      } else if (result.data.conflicts) {
        setConflicts(result.data.conflicts)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '继续rebase失败')
    } finally {
      setRebasing(false)
    }
  }

  const handleAbort = async (): Promise<void> => {
    try {
      const result = await window.api.git.rebaseAbort(repoPath)
      if (result.success) {
        setInProgress(false)
        setConflicts([])
        alert('已中止rebase')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '中止rebase失败')
    }
  }

  const handleSkip = async (): Promise<void> => {
    setRebasing(true)
    setError('')

    try {
      const result = await window.api.git.rebaseSkip(repoPath)

      if (result.success && result.data.success) {
        alert('已跳过当前提交')
        setInProgress(false)
        setConflicts([])
        onRebaseComplete?.()
      } else if (result.data.conflicts) {
        setConflicts(result.data.conflicts)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '跳过提交失败')
    } finally {
      setRebasing(false)
    }
  }

  if (conflicts.length > 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 bg-yellow-50 border-b">
          <h3 className="font-semibold text-yellow-800 mb-2">Rebase冲突</h3>
          <p className="text-sm text-yellow-700 mb-3">请解决冲突后继续rebase</p>
          <div className="flex gap-2">
            <button
              onClick={handleContinue}
              disabled={rebasing}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {rebasing ? '处理中...' : '继续Rebase'}
            </button>
            <button
              onClick={handleSkip}
              disabled={rebasing}
              className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
            >
              跳过当前提交
            </button>
            <button onClick={handleAbort} className="px-4 py-2 bg-red-500 text-white rounded">
              中止Rebase
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <GitConflictResolutionPanel repoPath={repoPath} onAllResolved={() => setConflicts([])} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Rebase分支</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">选择目标分支(将当前分支rebase到)</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            disabled={rebasing || inProgress}
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
          onClick={handleRebase}
          disabled={!selectedBranch || rebasing || inProgress}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {rebasing ? 'Rebase中...' : '开始Rebase'}
        </button>

        {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

        <div className="mt-4 p-3 bg-blue-50 rounded">
          <h3 className="font-semibold text-blue-800 mb-2">提示</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Rebase会将当前分支的提交应用到目标分支之上</li>
            <li>• 如果遇到冲突,需要手动解决后继续</li>
            <li>• 可以选择跳过某个提交或中止整个rebase操作</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
