import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent
} from '@/components/ui/dialog'
import { ChatInput } from '@/components/shared/ChatInput'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { db } from '@/data'
import type { AgentToolConfig } from '@/data'
import { getSettings } from '@/data/settings'
import { useLanguage } from '@/providers/language-provider'
import type { MessageAttachment } from '@/hooks/useAgent'
import { ChevronDown, GitBranch, Settings2, Sparkles, Workflow, Wrench } from 'lucide-react'

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
  displayName?: string
  name?: string
  installed?: boolean
}

interface PipelineTemplate {
  id: string
  name: string
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
        const installedTools = tools.filter((tool) => tool.installed !== false)
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
    setSelectedCliToolId('')
    setSelectedCliConfigId('')
    setSelectedTemplateId('')
    setSelectedBaseBranch('')
  }

  const selectedCliToolName = useMemo(() => {
    if (!selectedCliToolId) return 'CLI 工具'
    const tool = cliTools.find((item) => item.id === selectedCliToolId)
    return tool?.displayName || tool?.name || selectedCliToolId
  }, [cliTools, selectedCliToolId])

  const selectedCliConfigName = useMemo(() => {
    if (!selectedCliConfigId) return 'CLI 配置项'
    return cliConfigs.find((item) => item.id === selectedCliConfigId)?.name || 'CLI 配置项'
  }, [cliConfigs, selectedCliConfigId])

  const selectedWorkflowTemplateName = useMemo(() => {
    if (!selectedTemplateId) return '工作流'
    return pipelineTemplates.find((item) => item.id === selectedTemplateId)?.name || '工作流'
  }, [pipelineTemplates, selectedTemplateId])

  const handleSubmit = async (text: string, attachments?: MessageAttachment[]) => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(t.task.createTitleRequired)
      return
    }

    if (!text.trim() && (!attachments || attachments.length === 0)) {
      setError(t.task.createPromptRequired)
      return
    }

    setLoading(true)
    setError(null)

    const trimmedPrompt = text.trim()
    try {
      const settings = getSettings()
      const taskMode = selectedTemplateId ? 'workflow' : 'conversation'
      const worktreeBranchPrefix = settings.gitWorktreeBranchPrefix || 'VW-'
      const worktreeRootPath = settings.gitWorktreeDir || '~/.vibework/worktrees'
      const cliToolId =
        taskMode === 'conversation'
          ? selectedCliToolId || settings.defaultCliToolId || undefined
          : undefined
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
        workflowTemplateId: taskMode === 'workflow' ? selectedTemplateId : undefined
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="bg-muted flex size-10 items-center justify-center rounded-full">
              <Sparkles className="size-5" />
            </div>
            <h2 className="text-foreground text-3xl font-semibold tracking-tight">我能为你做什么？</h2>
          </div>

          <ChatInput
            variant="home"
            titleValue={title}
            onTitleChange={setTitle}
            titlePlaceholder="标题"
            requireTitle
            placeholder="提示词"
            onSubmit={handleSubmit}
            className="w-full"
            autoFocus
            disabled={loading}
            operationBar={
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="border-border bg-background hover:bg-accent/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors">
                    <Wrench className="size-3.5" />
                    <span className="max-w-[140px] truncate">{selectedCliToolName}</span>
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="max-h-64 w-56 overflow-auto">
                    {cliTools.map((tool) => (
                      <DropdownMenuItem
                        key={tool.id}
                        onSelect={() => setSelectedCliToolId(tool.id)}
                        className="cursor-pointer"
                      >
                        {tool.displayName || tool.name || tool.id}
                      </DropdownMenuItem>
                    ))}
                    {cliTools.length === 0 && (
                      <DropdownMenuItem disabled>暂无可用 CLI 工具</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    disabled={!selectedCliToolId || cliConfigs.length === 0}
                    className="border-border bg-background hover:bg-accent/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings2 className="size-3.5" />
                    <span className="max-w-[140px] truncate">{selectedCliConfigName}</span>
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="max-h-64 w-56 overflow-auto">
                    {cliConfigs.map((config) => (
                      <DropdownMenuItem
                        key={config.id}
                        onSelect={() => setSelectedCliConfigId(config.id)}
                        className="cursor-pointer"
                      >
                        {config.name}
                      </DropdownMenuItem>
                    ))}
                    {cliConfigs.length === 0 && (
                      <DropdownMenuItem disabled>请先选择 CLI 工具</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    disabled={!isGitProject || branches.length === 0}
                    className="border-border bg-background hover:bg-accent/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GitBranch className="size-3.5" />
                    <span className="max-w-[140px] truncate">
                      {selectedBaseBranch || '工作流基础分支'}
                    </span>
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="max-h-64 w-56 overflow-auto">
                    {branches.map((branch) => (
                      <DropdownMenuItem
                        key={branch}
                        onSelect={() => setSelectedBaseBranch(branch)}
                        className="cursor-pointer"
                      >
                        {branch}
                      </DropdownMenuItem>
                    ))}
                    {!isGitProject && <DropdownMenuItem disabled>当前项目不是 Git 仓库</DropdownMenuItem>}
                    {isGitProject && branches.length === 0 && (
                      <DropdownMenuItem disabled>暂无可用分支</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    className="border-border bg-background hover:bg-accent/60 text-muted-foreground inline-flex size-8 items-center justify-center rounded-full border transition-colors"
                    title={selectedTemplateId ? `工作流：${selectedWorkflowTemplateName}` : '不使用工作流'}
                    aria-label={selectedTemplateId ? `工作流：${selectedWorkflowTemplateName}` : '选择工作流'}
                  >
                    <Workflow className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className="max-h-64 w-56 overflow-auto">
                    {pipelineTemplates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onSelect={() => setSelectedTemplateId(template.id)}
                        className="cursor-pointer"
                      >
                        {template.name}
                      </DropdownMenuItem>
                    ))}
                    {pipelineTemplates.length === 0 && (
                      <DropdownMenuItem disabled>暂无可用工作流</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />

          {error && <div className="mt-3 text-sm text-red-500">{error}</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
