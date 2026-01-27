import { useState, useEffect } from 'react'

interface Commit {
  hash: string
  message: string
  author: string
  date: string
}

interface GitPRFormProps {
  repoPath: string
  onSubmit: (data: PRFormData) => void
  onCancel: () => void
}

export interface PRFormData {
  title: string
  description: string
  targetBranch: string
  sourceBranch: string
}

export function GitPRForm({ repoPath, onSubmit, onCancel }: GitPRFormProps) {
  const [branches, setBranches] = useState<string[]>([])
  const [currentBranch, setCurrentBranch] = useState<string>('')
  const [commits, setCommits] = useState<Commit[]>([])
  const [formData, setFormData] = useState<PRFormData>({
    title: '',
    description: '',
    targetBranch: 'main',
    sourceBranch: ''
  })

  useEffect(() => {
    loadData()
  }, [repoPath])

  const loadData = async () => {
    try {
      // 加载分支列表
      const branchResult = await window.api.git.getBranches?.(repoPath)
      if (branchResult?.success) {
        setBranches(branchResult.data || [])
      }

      // 获取当前分支
      const currentResult = await window.api.git.getCurrentBranch?.(repoPath)
      if (currentResult?.success) {
        const branch = currentResult.data
        setCurrentBranch(branch)
        setFormData(prev => ({ ...prev, sourceBranch: branch }))
      }

      // 加载提交历史
      const commitResult = await window.api.git.getCommitLog(repoPath, 10)
      if (commitResult?.success) {
        setCommits(commitResult.data || [])
        // 自动填充标题为最新提交消息
        if (commitResult.data?.length > 0) {
          setFormData(prev => ({
            ...prev,
            title: commitResult.data[0].message
          }))
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.targetBranch) {
      alert('请填写标题和目标分支')
      return
    }
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          当前分支
        </label>
        <input
          type="text"
          value={currentBranch}
          disabled
          className="w-full px-3 py-2 border rounded bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          目标分支 *
        </label>
        <select
          value={formData.targetBranch}
          onChange={(e) => setFormData({ ...formData, targetBranch: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          required
        >
          <option value="">请选择目标分支</option>
          {branches.filter(b => b !== currentBranch).map(branch => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          PR标题 *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="输入PR标题"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          描述
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          rows={6}
          placeholder="输入PR描述"
        />
      </div>

      {commits.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            最近提交 ({commits.length})
          </label>
          <div className="border rounded max-h-48 overflow-auto">
            {commits.map(commit => (
              <div key={commit.hash} className="px-3 py-2 border-b last:border-b-0 hover:bg-gray-50">
                <div className="text-sm font-medium">{commit.message}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {commit.author} · {commit.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          创建PR
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          取消
        </button>
      </div>
    </form>
  )
}
