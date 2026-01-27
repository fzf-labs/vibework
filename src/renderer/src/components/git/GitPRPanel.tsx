import { useState } from 'react'
import { GitPRForm, PRFormData } from './GitPRForm'

interface GitPRPanelProps {
  repoPath: string
}

export function GitPRPanel({ repoPath }: GitPRPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string>('')
  const [prUrl, setPrUrl] = useState<string>('')

  const handleCreatePR = async (formData: PRFormData) => {
    setPushing(true)
    setError('')
    setPrUrl('')

    try {
      // 1. 推送当前分支到远程
      await window.api.git.pushBranch(repoPath, formData.sourceBranch)

      // 2. 获取远程仓库URL
      const remoteResult = await window.api.git.getRemoteUrl(repoPath)
      if (!remoteResult.success) {
        throw new Error('无法获取远程仓库URL')
      }

      const remoteUrl = remoteResult.data
      const prLink = generatePRUrl(remoteUrl, formData)

      setPrUrl(prLink)
      setShowForm(false)
      alert('分支已推送到远程!\n请在浏览器中完成PR创建。')
    } catch (error: any) {
      setError(error.message || '创建PR失败')
    } finally {
      setPushing(false)
    }
  }

  const generatePRUrl = (remoteUrl: string, formData: PRFormData): string => {
    // 解析远程URL
    let url = remoteUrl
    if (url.startsWith('git@')) {
      // SSH格式: git@github.com:user/repo.git
      url = url.replace(':', '/').replace('git@', 'https://')
    }
    url = url.replace('.git', '')

    // 根据平台生成PR URL
    if (url.includes('github.com')) {
      return `${url}/compare/${formData.targetBranch}...${formData.sourceBranch}?expand=1&title=${encodeURIComponent(formData.title)}&body=${encodeURIComponent(formData.description)}`
    } else if (url.includes('gitlab.com')) {
      return `${url}/-/merge_requests/new?merge_request[source_branch]=${formData.sourceBranch}&merge_request[target_branch]=${formData.targetBranch}&merge_request[title]=${encodeURIComponent(formData.title)}&merge_request[description]=${encodeURIComponent(formData.description)}`
    } else {
      return url
    }
  }

  const handleOpenPR = () => {
    if (prUrl) {
      window.open(prUrl, '_blank')
    }
  }

  if (pushing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">推送中...</div>
          <div className="text-sm text-gray-600">正在推送分支到远程仓库</div>
        </div>
      </div>
    )
  }

  if (prUrl) {
    return (
      <div className="p-4">
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
          <h3 className="font-semibold text-green-800 mb-2">
            分支已推送成功!
          </h3>
          <p className="text-sm text-green-700 mb-3">
            请在浏览器中完成PR创建
          </p>
          <button
            onClick={handleOpenPR}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            在浏览器中打开
          </button>
        </div>

        <button
          onClick={() => {
            setPrUrl('')
            setShowForm(true)
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          创建另一个PR
        </button>
      </div>
    )
  }

  if (showForm) {
    return (
      <GitPRForm
        repoPath={repoPath}
        onSubmit={handleCreatePR}
        onCancel={() => setShowForm(false)}
      />
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Pull Request</h2>

      <div className="space-y-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          创建新的PR
        </button>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded">
          <h3 className="font-semibold text-blue-800 mb-2">说明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 创建PR前会自动推送当前分支到远程仓库</li>
            <li>• 支持GitHub和GitLab平台</li>
            <li>• 会在浏览器中打开PR创建页面</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
