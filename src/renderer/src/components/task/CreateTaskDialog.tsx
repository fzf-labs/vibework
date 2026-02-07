import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { db } from '@/data'
import type { AgentToolConfig } from '@/data'
import { getSettings } from '@/data/settings'
import { useLanguage } from '@/providers/language-provider'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  onTaskCreated?: (task: any) => void
}

interface CLIToolInfo {
  id: string
  displayName: string
  installed: boolean
}

interface PipelineTemplate {
  id: string
  name: string
  description?: string | null
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  projectPath,
  projectType = 'normal',
  onTaskCreated
}: CreateTaskDialogProps) {
  const { t } = useLanguage()
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([])
  const [selectedCliToolId, setSelectedCliToolId] = useState('')
  const [cliConfigs, setCliConfigs] = useState<AgentToolConfig[]>([])
  const [selectedCliConfigId, setSelectedCliConfigId] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBaseBranch, setSelectedBaseBranch] = useState('')
  const [pipelineTemplates, setPipelineTemplates] = useState<PipelineTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGitProject = projectType === 'git'

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelectedTemplateId('')
    setBranches([])
    setSelectedBaseBranch('')

    const loadTools = async () => {
      try {
        const detected = await window.api?.cliTools?.detectAll?.()
        const tools = (Array.isArray(detected) ? detected : []) as CLIToolInfo[]
        const installedTools = tools.filter((tool) => tool.installed)
        setCliTools(installedTools)

        const settings = getSettings()
        if (settings.defaultCliToolId) {
          const hasDefault = installedTools.some(
            (tool) => tool.id === settings.defaultCliToolId
          )
          if (hasDefault) {
            setSelectedCliToolId(settings.defaultCliToolId)
          }
        }
      } catch (err) {
        console.error('Failed to detect CLI tools:', err)
        setCliTools([])
      }
    }

    const loadTemplates = async () => {
      if (!projectId) {
        setPipelineTemplates([])
        return
      }
      try {
        const projectTemplates = await db.getWorkflowTemplatesByProject(projectId)
        setPipelineTemplates(projectTemplates as PipelineTemplate[])
      } catch (err) {
        console.error('Failed to load pipeline templates:', err)
        setPipelineTemplates([])
      }
    }

    const loadBranches = async () => {
      if (!isGitProject || !projectPath) {
        setBranches([])
        return
      }
      try {
        const [branchesResult, currentResult] = await Promise.all([
          window.api?.git?.getBranches?.(projectPath),
          window.api?.git?.getCurrentBranch?.(projectPath)
        ])
        const branchList = Array.isArray(branchesResult)
          ? (branchesResult as string[])
          : Array.isArray((branchesResult as any)?.data)
            ? ((branchesResult as any).data as string[])
            : []
        const currentBranch =
          typeof currentResult === 'string'
            ? currentResult
            : ((currentResult as any)?.data as string | undefined)
        setBranches(branchList)
        if (currentBranch && branchList.includes(currentBranch)) {
          setSelectedBaseBranch(currentBranch)
        } else if (branchList.length > 0) {
          setSelectedBaseBranch(branchList[0])
        }
      } catch (err) {
        console.error('Failed to load git branches:', err)
        setBranches([])
      }
    }

    loadTools()
    loadTemplates()
    loadBranches()
  }, [open, projectId, projectPath, isGitProject])

  useEffect(() => {
    if (!open) return
    if (!selectedCliToolId) {
      setCliConfigs([])
      setSelectedCliConfigId('')
      return
    }
    const loadConfigs = async () => {
      try {
        const result = await db.listAgentToolConfigs(selectedCliToolId)
        const list = Array.isArray(result) ? (result as AgentToolConfig[]) : []
        setCliConfigs(list)
        const defaultConfig = list.find((cfg) => cfg.is_default)
        setSelectedCliConfigId(defaultConfig?.id || '')
      } catch (err) {
        console.error('Failed to load CLI configs:', err)
        setCliConfigs([])
        setSelectedCliConfigId('')
      }
    }
    void loadConfigs()
  }, [open, selectedCliToolId])

  const resetForm = () => {
    setTitle('')
    setPrompt('')
    setSelectedCliToolId('')
    setSelectedCliConfigId('')
    setSelectedTemplateId('')
    setSelectedBaseBranch('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError(t.task.createTitleRequired)
      return
    }
    if (!prompt.trim()) {
      setError(t.task.createPromptRequired)
      return
    }

    const taskMode = selectedTemplateId ? 'workflow' : 'conversation'

    if (taskMode === 'conversation') {
      if (!selectedCliToolId) {
        setError(t.task.createCliRequired)
        return
      }
      if (cliConfigs.length > 0 && !selectedCliConfigId) {
        setError(t.task.createCliConfigRequired || '请选择 CLI 配置项')
        return
      }
      if (cliConfigs.length === 0) {
        setError(t.task.createCliConfigEmpty || '请先创建 CLI 配置项')
        return
      }
    }
    if (isGitProject && !selectedBaseBranch) {
      setError(t.task.createBaseBranchRequired)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const trimmedPrompt = prompt.trim()
      const trimmedTitle = title.trim()
      const settings = getSettings()
      const worktreeBranchPrefix = settings.gitWorktreeBranchPrefix || 'VW-'
      const worktreeRootPath = settings.gitWorktreeDir || '~/.vibework/worktrees'
      const workflowTemplateId = taskMode === 'workflow' ? selectedTemplateId : undefined
      const cliToolId = taskMode === 'conversation' ? selectedCliToolId : undefined
      const agentToolConfigId = taskMode === 'conversation' ? selectedCliConfigId || undefined : undefined

      const result = await window.api.task.create({
        title: trimmedTitle,
        prompt: trimmedPrompt,
        taskMode,
        projectId,
        projectPath,
        createWorktree: isGitProject && !!projectPath,
        baseBranch: isGitProject ? selectedBaseBranch : undefined,
        worktreeBranchPrefix,
        worktreeRootPath,
        cliToolId,
        agentToolConfigId,
        workflowTemplateId
      })

      if (result.success && result.data) {
        onTaskCreated?.(result.data)
        resetForm()
        onOpenChange(false)
      } else {
        setError(result.error || t.task.createTaskFailed)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const renderTemplateOptions = () =>
    pipelineTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.task.createTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t.task.createTitleLabel}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.task.createTitlePlaceholder}
              className={cn(
                'mt-1.5 w-full px-3 py-2 text-sm',
                'bg-background border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t.task.createPromptLabel}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.task.createPromptPlaceholder}
              className={cn(
                'mt-1.5 w-full min-h-[100px] px-3 py-2 text-sm',
                'bg-background border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t.task.createCliLabel}</label>
            <select
              value={selectedCliToolId}
              onChange={(e) => setSelectedCliToolId(e.target.value)}
              className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t.task.createCliPlaceholder}</option>
              {cliTools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              {t.task.createCliConfigLabel || 'CLI 配置项'}
            </label>
            <select
              value={selectedCliConfigId}
              onChange={(e) => setSelectedCliConfigId(e.target.value)}
              disabled={!selectedCliToolId || cliConfigs.length === 0}
              className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">
                {t.task.createCliConfigPlaceholder || '请选择 CLI 配置项'}
              </option>
              {cliConfigs.map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name}
                </option>
              ))}
            </select>
            {!selectedCliToolId && (
              <div className="text-muted-foreground mt-1 text-xs">
                {t.task.createCliConfigSelectTool || '请先选择 CLI 工具'}
              </div>
            )}
            {selectedCliToolId && cliConfigs.length === 0 && (
              <div className="text-amber-500 mt-1 text-xs">
                {t.task.createCliConfigEmpty || '请先创建 CLI 配置项'}
              </div>
            )}
          </div>

          {isGitProject && (
            <div>
              <label className="text-sm font-medium">{t.task.createBaseBranchLabel}</label>
              <select
                value={selectedBaseBranch}
                onChange={(e) => setSelectedBaseBranch(e.target.value)}
                className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">{t.task.createBaseBranchPlaceholder}</option>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">{t.task.createPipelineLabel}</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={!projectId}
              className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">不选择（对话模式）</option>
              {renderTemplateOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {!projectId && (
              <div className="text-muted-foreground mt-1 text-xs">
                {t.task.createPipelineProjectRequired}
              </div>
            )}
            {projectId && pipelineTemplates.length === 0 && (
              <div className="text-amber-500 mt-1 text-xs">
                请先创建工作流模板
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? t.task.createLoading : t.task.createSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
