import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkNode {
  id: string;
  name: string;
  prompt: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
}

interface AgentExecution {
  id: string;
  execution_index: number;
  status: 'idle' | 'running' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  cost: number | null;
  duration: number | null;
}

interface WorkNodeReviewPanelProps {
  node: WorkNode;
  executions: AgentExecution[];
  onApprove: () => void;
  onReject: () => void;
}

export function WorkNodeReviewPanel({
  node,
  executions,
  onApprove,
  onReject,
}: WorkNodeReviewPanelProps) {
  const { t } = useLanguage();

  return (
    <div className={cn(
      'space-y-4 rounded-xl border p-4',
      'border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Clock className="size-4 text-amber-500" />
          <span>节点审核</span>
          <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 text-xs">
            等待审核
          </span>
        </div>
      </div>

      {/* Node Info */}
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">节点名称</p>
          <p className="text-foreground text-sm font-medium">{node.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">执行提示词</p>
          <p className="text-foreground text-sm">{node.prompt}</p>
        </div>
      </div>

      {/* Execution History */}
      {executions.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">执行历史</p>
          <div className="space-y-1">
            {executions.map((exec) => (
              <ExecutionItem key={exec.id} execution={exec} />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          className="flex-1 border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          <X className="mr-1 size-4" />
          拒绝
        </Button>
        <Button
          size="sm"
          onClick={onApprove}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          <Check className="mr-1 size-4" />
          批准
        </Button>
      </div>
    </div>
  );
}

function ExecutionItem({ execution }: { execution: AgentExecution }) {
  const statusIcon = {
    idle: <Clock className="size-3 text-gray-400" />,
    running: <AlertCircle className="size-3 text-blue-500" />,
    completed: <Check className="size-3 text-emerald-500" />,
  }[execution.status];

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        {statusIcon}
        <span>执行 #{execution.execution_index}</span>
      </div>
      {execution.duration && (
        <span>{(execution.duration / 1000).toFixed(1)}s</span>
      )}
    </div>
  );
}
