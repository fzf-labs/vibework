import { cn } from '@/lib/utils';
import { Check, Circle, Clock, AlertCircle } from 'lucide-react';

interface WorkNode {
  id: string;
  name: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  node_order: number;
}

interface WorkflowProgressBarProps {
  nodes: WorkNode[];
  currentNodeIndex: number;
}

export function WorkflowProgressBar({
  nodes,
  currentNodeIndex,
}: WorkflowProgressBarProps) {
  const completedCount = nodes.filter(n => n.status === 'done').length;
  const progress = nodes.length > 0 ? (completedCount / nodes.length) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{nodes.length}
        </span>
      </div>

      {/* Node Status Badges */}
      <div className="flex gap-1 flex-wrap">
        {nodes.map((node, index) => (
          <WorkNodeStatusBadge
            key={node.id}
            node={node}
            isCurrent={index === currentNodeIndex}
          />
        ))}
      </div>
    </div>
  );
}

interface WorkNodeStatusBadgeProps {
  node: WorkNode;
  isCurrent: boolean;
}

function WorkNodeStatusBadge({ node, isCurrent }: WorkNodeStatusBadgeProps) {
  const statusConfig = {
    todo: {
      icon: Circle,
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-500',
      ring: '',
    },
    in_progress: {
      icon: Clock,
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-2 ring-blue-500',
    },
    in_review: {
      icon: Clock,
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-2 ring-amber-500',
    },
    done: {
      icon: Check,
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: '',
    },
    error: {
      icon: AlertCircle,
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      ring: '',
    },
  };

  const config = statusConfig[node.status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        config.bg,
        config.text,
        isCurrent && config.ring
      )}
    >
      <Icon className="size-3" />
      <span className="truncate max-w-20">{node.name}</span>
    </div>
  );
}
