import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent
} from '@/components/ui/dialog'
import { ChatInput } from '@/components/shared/ChatInput'
import {
  TaskCreateMenu,
  type TaskMode,
} from '@/components/task/TaskCreateMenu'
import { db } from '@/data'
import type { AgentToolConfig } from '@/data'
import { getSettings } from '@/data/settings'
import { useLanguage } from '@/providers/language-provider'
import type { MessageAttachment } from '@/hooks/useAgent'
import { normalizeCliTools, type CLIToolInfo } from '@/lib/cli-tools'
import { Sparkles } from 'lucide-react'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  onTaskCreated?: (task: any) => void
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
  const [taskMode, setTaskMode] = useState<TaskMode>('conversation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGitProject = projectType === 'git'

  useEffect(() => {
    if (!open) return
    setError(null)
    setTaskMode('conversation')
    setSelectedTemplateId('')
    setBranches([])
    setSelectedBaseBranch('')

    const loadTools = async () => {
      try {
        const snapshot = await window.api?.cliTools?.getSnapshot?.()
        const tools = normalizeCliTools(snapshot)
        setCliTools(tools)

        const settings = getSettings()
        if (settings.defaultCliToolId) {
          const hasDefault = tools.some(
            (tool) => tool.id === settings.defaultCliToolId
          )
          if (hasDefault) {
            setSelectedCliToolId(settings.defaultCliToolId)
          }
        }

        void window.api?.cliTools?.refresh?.({ level: 'fast' })
      } catch (err) {
        console.error('Failed to detect CLI tools:', err)
        setCliTools([])
      }
    }

    const unsubscribe = window.api?.cliTools?.onUpdated?.((tools) => {
      setCliTools(normalizeCliTools(tools))
    })

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

    return () => {
      unsubscribe?.()
    }
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
    setTaskMode('conversation')
    setSelectedCliToolId('')
    setSelectedCliConfigId('')
    setSelectedTemplateId('')
    setSelectedBaseBranch('')
  }

  useEffect(() => {
    if (taskMode !== 'workflow') return
    if (pipelineTemplates.length === 0) {
      if (selectedTemplateId) setSelectedTemplateId('')
      return
    }
    const exists = pipelineTemplates.some((template) => template.id === selectedTemplateId)
    if (!exists) {
      setSelectedTemplateId(pipelineTemplates[0].id)
    }
  }, [pipelineTemplates, selectedTemplateId, taskMode])

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

    const settings = getSettings()
    const resolvedCliToolId = selectedCliToolId || settings.defaultCliToolId || ''
    const resolvedCliConfigId =
      selectedCliConfigId || cliConfigs.find((config) => config.is_default)?.id || ''

    if (taskMode === 'conversation') {
      if (!resolvedCliToolId) {
        setError(t.task.createCliRequired)
        return
      }
      if (!resolvedCliConfigId) {
        setError(t.task.createCliConfigRequired)
        return
      }
    }

    if (taskMode === 'workflow') {
      if (!projectId) {
        setError(t.task.createPipelineProjectRequired)
        return
      }
      if (!selectedTemplateId) {
        setError(t.task.createWorkflowRequired)
        return
      }
    }

    if (isGitProject && !selectedBaseBranch) {
      setError(t.task.createBaseBranchRequired)
      return
    }

    setLoading(true)
    setError(null)

    const trimmedPrompt = text.trim()
    try {
      const worktreeBranchPrefix = settings.gitWorktreeBranchPrefix || 'VW-'
      const worktreeRootPath = settings.gitWorktreeDir || '~/.vibework/worktrees'
      const cliToolId = taskMode === 'conversation' ? resolvedCliToolId : undefined
      const agentToolConfigId = taskMode === 'conversation' ? resolvedCliConfigId : undefined

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
              <TaskCreateMenu
                taskMode={taskMode}
                onTaskModeChange={setTaskMode}
                canUseWorkflowMode={Boolean(projectId)}
                cliTools={cliTools}
                selectedCliToolId={selectedCliToolId}
                onSelectCliToolId={setSelectedCliToolId}
                cliConfigs={cliConfigs}
                selectedCliConfigId={selectedCliConfigId}
                onSelectCliConfigId={setSelectedCliConfigId}
                workflowTemplates={pipelineTemplates}
                selectedTemplateId={selectedTemplateId}
                onSelectTemplateId={setSelectedTemplateId}
                isGitProject={isGitProject}
                branches={branches}
                selectedBaseBranch={selectedBaseBranch}
                onSelectBaseBranch={setSelectedBaseBranch}
              />
            }
          />

          {error && <div className="mt-3 text-sm text-red-500">{error}</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
