import { useMemo } from 'react'
import { ChevronDown, GitBranch, Settings2, Wrench } from 'lucide-react'

import type { AgentToolConfig } from '@/data'
import { useLanguage } from '@/providers/language-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type TaskMode = 'conversation' | 'workflow'

export interface TaskMenuCliToolInfo {
  id: string
  displayName?: string
  name?: string
  installed?: boolean
}

export interface TaskMenuWorkflowTemplate {
  id: string
  name: string
}

interface TaskCreateMenuProps {
  taskMode: TaskMode
  onTaskModeChange: (mode: TaskMode) => void
  canUseWorkflowMode: boolean

  cliTools: TaskMenuCliToolInfo[]
  selectedCliToolId: string
  onSelectCliToolId: (toolId: string) => void

  cliConfigs: AgentToolConfig[]
  selectedCliConfigId: string
  onSelectCliConfigId: (configId: string) => void

  workflowTemplates: TaskMenuWorkflowTemplate[]
  selectedTemplateId: string
  onSelectTemplateId: (templateId: string) => void

  isGitProject: boolean
  branches: string[]
  selectedBaseBranch: string
  onSelectBaseBranch: (branch: string) => void
}

export function TaskCreateMenu({
  taskMode,
  onTaskModeChange,
  canUseWorkflowMode,
  cliTools,
  selectedCliToolId,
  onSelectCliToolId,
  cliConfigs,
  selectedCliConfigId,
  onSelectCliConfigId,
  workflowTemplates,
  selectedTemplateId,
  onSelectTemplateId,
  isGitProject,
  branches,
  selectedBaseBranch,
  onSelectBaseBranch,
}: TaskCreateMenuProps) {
  const { t } = useLanguage()

  const selectedCliToolName = useMemo(() => {
    if (!selectedCliToolId) return t.task.createCliLabel
    const tool = cliTools.find((item) => item.id === selectedCliToolId)
    return tool?.displayName || tool?.name || selectedCliToolId
  }, [cliTools, selectedCliToolId, t.task.createCliLabel])

  const selectedCliConfigName = useMemo(() => {
    if (!selectedCliConfigId) return t.task.createCliConfigLabel
    return cliConfigs.find((item) => item.id === selectedCliConfigId)?.name || t.task.createCliConfigLabel
  }, [cliConfigs, selectedCliConfigId, t.task.createCliConfigLabel])

  const selectedWorkflowTemplateName = useMemo(() => {
    if (selectedTemplateId) {
      return workflowTemplates.find((item) => item.id === selectedTemplateId)?.name || t.task.createPipelineLabel
    }
    return workflowTemplates[0]?.name || t.task.createPipelineLabel
  }, [selectedTemplateId, t.task.createPipelineLabel, workflowTemplates])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="border-border bg-background inline-flex overflow-hidden rounded-full border">
        <button
          type="button"
          onClick={() => onTaskModeChange('conversation')}
          className={
            taskMode === 'conversation'
              ? 'bg-primary text-primary-foreground px-3 py-1.5 text-xs'
              : 'hover:bg-accent/60 text-foreground px-3 py-1.5 text-xs'
          }
        >
          {t.task.createModeConversation}
        </button>
        <button
          type="button"
          onClick={() => onTaskModeChange('workflow')}
          disabled={!canUseWorkflowMode}
          className={
            taskMode === 'workflow'
              ? 'bg-primary text-primary-foreground px-3 py-1.5 text-xs disabled:opacity-50'
              : 'hover:bg-accent/60 text-foreground px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50'
          }
        >
          {t.task.createModeWorkflow}
        </button>
      </div>

      {taskMode === 'conversation' && (
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
                onSelect={() => onSelectCliToolId(tool.id)}
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
      )}

      {taskMode === 'conversation' && (
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
                onSelect={() => onSelectCliConfigId(config.id)}
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
      )}

      {taskMode === 'workflow' && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            disabled={workflowTemplates.length === 0}
            className="border-border bg-background hover:bg-accent/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title={selectedWorkflowTemplateName}
            aria-label={selectedWorkflowTemplateName}
          >
            <span className="max-w-[180px] truncate">{selectedWorkflowTemplateName}</span>
            <ChevronDown className="size-3.5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="max-h-64 w-56 overflow-auto">
            {workflowTemplates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onSelect={() => onSelectTemplateId(template.id)}
                className="cursor-pointer"
              >
                {template.name}
              </DropdownMenuItem>
            ))}
            {workflowTemplates.length === 0 && (
              <DropdownMenuItem disabled>暂无可用工作流</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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
              onSelect={() => onSelectBaseBranch(branch)}
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
    </div>
  )
}
