import { cn } from '@/lib/utils';
import { type Task, type TaskStatus } from '@/data';
import {
  GitBranch,
  FolderGit2,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Square,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskMetadataPanelProps {
  task: Task | null;
  onStatusChange?: (status: TaskStatus) => void;
  onOpenWorktree?: () => void;
  className?: string;
}

const statusConfig: Record<
  TaskStatus,
  { icon: typeof Clock; label: string; color: string }
> = {
  todo: {
    icon: Clock,
    label: 'Todo',
    color: 'text-slate-500 bg-slate-500/10',
  },
  in_progress: {
    icon: Play,
    label: 'In Progress',
    color: 'text-blue-500 bg-blue-500/10',
  },
  in_review: {
    icon: Clock,
    label: 'In Review',
    color: 'text-amber-500 bg-amber-500/10',
  },
  done: {
    icon: CheckCircle,
    label: 'Done',
    color: 'text-green-500 bg-green-500/10',
  },
  running: {
    icon: Play,
    label: 'Running',
    color: 'text-blue-500 bg-blue-500/10',
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    color: 'text-green-500 bg-green-500/10',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'text-red-500 bg-red-500/10',
  },
  stopped: {
    icon: Square,
    label: 'Stopped',
    color: 'text-zinc-500 bg-zinc-500/10',
  },
};

export function TaskMetadataPanel({
  task,
  onStatusChange,
  onOpenWorktree,
  className,
}: TaskMetadataPanelProps) {
  if (!task) return null;

  const config = statusConfig[task.status];
  const StatusIcon = config?.icon || Clock;
  const isExecutionStatus = ['running', 'completed', 'error', 'stopped'].includes(task.status);

  return (
    <div className={cn('space-y-3 p-3', className)}>
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          Status
        </span>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
            config?.color
          )}
        >
          <StatusIcon className="size-3" />
          {config?.label || task.status}
        </div>
      </div>

      {/* Branch Info */}
      {task.branch_name && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            Branch
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <GitBranch className="text-muted-foreground size-3" />
            <code className="bg-muted rounded px-1.5 py-0.5">
              {task.branch_name}
            </code>
          </div>
        </div>
      )}

      {/* Worktree Path */}
      {task.worktree_path && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Worktree
            </span>
            {onOpenWorktree && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onOpenWorktree}
              >
                <ExternalLink className="mr-1 size-3" />
                Open
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <FolderGit2 className="text-muted-foreground size-3 shrink-0" />
            <code className="bg-muted truncate rounded px-1.5 py-0.5">
              {task.worktree_path}
            </code>
          </div>
        </div>
      )}

      {/* Workspace Path */}
      {task.workspace_path && !task.worktree_path && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Workspace
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <FolderGit2 className="text-muted-foreground size-3 shrink-0" />
            <code className="bg-muted truncate rounded px-1.5 py-0.5">
              {task.workspace_path}
            </code>
          </div>
        </div>
      )}

      {/* CLI Tool */}
      {task.cli_tool_id && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            CLI
          </span>
          <div className="text-xs font-mono">{task.cli_tool_id}</div>
        </div>
      )}

      {/* Status Actions */}
      {onStatusChange && isExecutionStatus && task.status !== 'completed' && (
        <div className="border-border/50 flex gap-2 border-t pt-3">
          {task.status === 'running' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => onStatusChange('stopped')}
            >
              <Square className="mr-1 size-3" />
              Stop
            </Button>
          )}
          {(task.status === 'stopped' || task.status === 'error') && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => onStatusChange('completed')}
            >
              <CheckCircle className="mr-1 size-3" />
              Mark Complete
            </Button>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="border-border/50 space-y-1.5 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Created</span>
          <span className="text-xs">
            {new Date(task.created_at).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Updated</span>
          <span className="text-xs">
            {new Date(task.updated_at).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
