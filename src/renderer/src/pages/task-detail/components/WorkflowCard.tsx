import { CheckCircle, Clock, ListChecks } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import type { LanguageStrings, PipelineDisplayStatus } from '../types'

type TemplateNode = {
  id: string
  name?: string
  prompt?: string
}

export type WorkflowDisplayNode = {
  id: string
  node_order: number
  status: PipelineDisplayStatus
  name?: string
  prompt?: string
}

interface WorkflowReviewNode {
  id: string
  name: string
  status: PipelineDisplayStatus
}

interface WorkflowCardProps {
  t: LanguageStrings
  nodes: WorkflowDisplayNode[]
  templateNodeMap: ReadonlyMap<string, TemplateNode>
  currentTaskNode: WorkflowReviewNode | null
  onApproveCurrent: () => void
}

export function WorkflowCard({
  t,
  nodes,
  templateNodeMap,
  currentTaskNode,
  onApproveCurrent
}: WorkflowCardProps) {
  return (
    <section className="border-border/50 bg-background/95 rounded-xl border shadow-sm">
      <div className="border-border/50 flex items-center gap-2 border-b px-3 py-2">
        <ListChecks className="text-muted-foreground size-3.5" />
        <span className="text-muted-foreground text-xs font-semibold">
          {t.task.workflowCardTitle || 'Workflow'}
        </span>
      </div>
      <div className="space-y-2 px-3 py-2">
        {nodes.length > 0 && (
          <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
            <div className="flex min-w-max items-center gap-1 pr-2">
              {nodes.map((node, index) => {
                const nodeStatus = node.status
                const isCompleted = nodeStatus === 'done'
                const isRunningNode = nodeStatus === 'in_progress'
                const isWaiting = nodeStatus === 'in_review'
                const isTodo = nodeStatus === 'todo'
                const templateNode = templateNodeMap.get(node.id)
                const nodeName =
                  node.name || templateNode?.name || `${t.task.stageLabel} ${index + 1}`
                const nodePrompt = node.prompt || templateNode?.prompt

                return (
                  <div key={node.id} className="flex items-center">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                        isCompleted && 'bg-green-500/10 text-green-600',
                        isWaiting && 'bg-amber-500/10 text-amber-600',
                        isRunningNode && 'bg-blue-500/10 text-blue-600',
                        isTodo && 'bg-muted/40 text-muted-foreground'
                      )}
                      title={nodePrompt}
                    >
                      {isCompleted && <CheckCircle className="size-3" />}
                      {isRunningNode && (
                        <span className="size-2 animate-pulse rounded-full bg-blue-500" />
                      )}
                      {isWaiting && <Clock className="size-3" />}
                      {isTodo && (
                        <span className="size-2 rounded-full bg-muted-foreground/30" />
                      )}
                      <span className="max-w-[80px] truncate">{nodeName}</span>
                    </div>
                    {index < nodes.length - 1 && (
                      <div
                        className={cn(
                          'mx-0.5 h-px w-3',
                          isCompleted ? 'bg-green-500/50' : 'bg-muted-foreground/20'
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {currentTaskNode?.status === 'in_review' && (
          <div className="border-amber-500/30 bg-amber-50/30 rounded-md border px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-700">
                  {t.task.taskNodeReviewTitle || 'Task node review'}
                </p>
                <p className="text-muted-foreground truncate text-xs">{currentTaskNode.name}</p>
              </div>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={onApproveCurrent}>
                {t.task.confirmComplete || 'Confirm complete'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
