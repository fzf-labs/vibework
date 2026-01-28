import { useState, useEffect } from 'react';
import { Plus, GitBranch, Clock, X, Play, Square, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CreateTaskDialog } from '@/components/task/CreateTaskDialog';
import { ClaudeCodeSession } from '@/components/cli/ClaudeCodeSession';
import { useProjects } from '@/hooks/useProjects';
import type { TaskPipelineStatus } from '@/data/types';

// Task type from API (camelCase fields)
interface TaskWithWorktree {
  id: string;
  sessionId: string;
  taskIndex: number;
  prompt: string;
  status: string;
  projectId: string | null;
  worktreePath: string | null;
  branchName: string | null;
  cost: number | null;
  duration: number | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

// Column configuration
const columns: { id: TaskPipelineStatus; title: string; color: string }[] = [
  { id: 'todo', title: '待办', color: 'bg-zinc-500' },
  { id: 'in_progress', title: '进行中', color: 'bg-blue-500' },
  { id: 'in_review', title: '审查中', color: 'bg-amber-500' },
  { id: 'done', title: '已完成', color: 'bg-green-500' },
];

// Map old status to pipeline status
function mapToPipelineStatus(status: string): TaskPipelineStatus {
  switch (status) {
    case 'running':
      return 'in_progress';
    case 'completed':
      return 'done';
    case 'error':
    case 'stopped':
      return 'in_review';
    default:
      return (status as TaskPipelineStatus) || 'todo';
  }
}

export function BoardPage() {
  const { currentProject } = useProjects();
  const [tasks, setTasks] = useState<TaskWithWorktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<TaskWithWorktree | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithWorktree | null>(null);

  // Load tasks
  useEffect(() => {
    loadTasks();
  }, [currentProject?.id]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = currentProject?.id
        ? await window.api.task.getByProject(currentProject.id)
        : await window.api.task.getAll();
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group tasks by pipeline status
  const tasksByStatus = columns.reduce(
    (acc, col) => {
      acc[col.id] = tasks.filter(
        (task) => mapToPipelineStatus(task.status) === col.id
      );
      return acc;
    },
    {} as Record<TaskPipelineStatus, TaskWithWorktree[]>
  );

  // Handle drag start
  const handleDragStart = (task: TaskWithWorktree) => {
    setDraggedTask(task);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle drop - update task status
  const handleDrop = async (targetStatus: TaskPipelineStatus) => {
    if (!draggedTask) return;

    const currentStatus = mapToPipelineStatus(draggedTask.status);
    if (currentStatus === targetStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggedTask.id ? { ...t, status: targetStatus } : t
      )
    );

    try {
      await window.api.task.updateStatus(draggedTask.id, targetStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
      loadTasks(); // Reload on error
    }

    setDraggedTask(null);
  };

  // Handle task click - open sidebar
  const handleTaskClick = (task: TaskWithWorktree) => {
    setSelectedTask(task);
  };

  // Handle close sidebar
  const handleCloseSidebar = () => {
    setSelectedTask(null);
  };

  // Handle status change from sidebar
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    try {
      await window.api.task.updateStatus(taskId, newStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
      loadTasks();
    }
  };

  // Handle task created
  const handleTaskCreated = (task: TaskWithWorktree) => {
    setTasks((prev) => [task, ...prev]);
  };

  // Generate session ID for new tasks
  const generateSessionId = () => {
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    return `${timestamp}_board`;
  };

  return (
    <div className="relative flex h-full">
      {/* Main Content */}
      <div className={cn(
        'flex h-full flex-1 flex-col transition-all duration-300',
        selectedTask && 'mr-[480px]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">任务看板</h1>
            {currentProject && (
              <p className="text-muted-foreground text-sm">
                {currentProject.name}
              </p>
            )}
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建任务
          </Button>
        </div>

        {/* Board */}
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={tasksByStatus[column.id]}
              loading={loading}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
              onTaskDragStart={handleDragStart}
              onTaskClick={handleTaskClick}
              isDragTarget={draggedTask !== null}
              selectedTaskId={selectedTask?.id}
            />
          ))}
        </div>
      </div>

      {/* Task Detail Sidebar */}
      <TaskDetailSidebar
        task={selectedTask}
        projectPath={currentProject?.path}
        onClose={handleCloseSidebar}
        onStatusChange={handleStatusChange}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={currentProject?.id}
        projectPath={currentProject?.path}
        sessionId={generateSessionId()}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}

// Board Column Component
interface BoardColumnProps {
  column: { id: TaskPipelineStatus; title: string; color: string };
  tasks: TaskWithWorktree[];
  loading: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onTaskDragStart: (task: TaskWithWorktree) => void;
  onTaskClick: (task: TaskWithWorktree) => void;
  isDragTarget: boolean;
  selectedTaskId?: string;
}

function BoardColumn({
  column,
  tasks,
  loading,
  onDragOver,
  onDrop,
  onTaskDragStart,
  onTaskClick,
  isDragTarget,
  selectedTaskId,
}: BoardColumnProps) {
  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30',
        isDragTarget && 'ring-2 ring-primary/20'
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className={cn('h-2 w-2 rounded-full', column.color)} />
        <span className="text-sm font-medium">{column.title}</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {loading ? (
          <div className="text-muted-foreground p-4 text-center text-sm">
            加载中...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">
            暂无任务
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={task.id === selectedTaskId}
              onDragStart={() => onTaskDragStart(task)}
              onClick={() => onTaskClick(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Task Card Component
interface TaskCardProps {
  task: TaskWithWorktree;
  isSelected?: boolean;
  onDragStart: () => void;
  onClick: () => void;
}

function TaskCard({ task, isSelected, onDragStart, onClick }: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md border bg-card p-3 shadow-sm',
        'transition-all hover:shadow-md hover:border-primary/50',
        'active:cursor-grabbing',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
    >
      {/* Task prompt */}
      <p className="line-clamp-2 text-sm">{task.prompt}</p>

      {/* Task metadata */}
      <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
        {task.branchName && (
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span className="max-w-[80px] truncate">{task.branchName}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// Task Detail Sidebar Component
interface TaskDetailSidebarProps {
  task: TaskWithWorktree | null;
  projectPath?: string;
  onClose: () => void;
  onStatusChange: (taskId: string, status: string) => void;
}

function TaskDetailSidebar({
  task,
  projectPath,
  onClose,
  onStatusChange,
}: TaskDetailSidebarProps) {
  const workdir = task?.worktreePath || projectPath || '';

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-50 h-full w-[480px] border-l bg-background shadow-xl',
        'transform transition-transform duration-300 ease-in-out',
        task ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {task && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-semibold">任务详情</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Task Info */}
            <div className="border-b p-4">
              <p className="text-sm">{task.prompt}</p>
            </div>

            {/* CLI Session */}
            <div className="flex-1 overflow-hidden p-4">
              <h3 className="mb-3 text-sm font-medium">CLI 终端</h3>
              <ClaudeCodeSession
                sessionId={task.id}
                workdir={workdir}
                className="h-full"
              />
            </div>

            {/* Metadata Panel */}
            <div className="border-t">
              <TaskMetadataInline
                task={task}
                onStatusChange={(status) => onStatusChange(task.id, status)}
                onOpenWorktree={() => {
                  if (task.worktreePath) {
                    window.api.shell.showItemInFolder(task.worktreePath);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Task Metadata Component
interface TaskMetadataInlineProps {
  task: TaskWithWorktree;
  onStatusChange?: (status: string) => void;
  onOpenWorktree?: () => void;
}

const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  todo: { icon: Clock, label: '待办', color: 'text-zinc-500 bg-zinc-500/10' },
  in_progress: { icon: Play, label: '进行中', color: 'text-blue-500 bg-blue-500/10' },
  in_review: { icon: Clock, label: '审查中', color: 'text-amber-500 bg-amber-500/10' },
  done: { icon: CheckCircle, label: '已完成', color: 'text-green-500 bg-green-500/10' },
  running: { icon: Play, label: '运行中', color: 'text-blue-500 bg-blue-500/10' },
  completed: { icon: CheckCircle, label: '已完成', color: 'text-green-500 bg-green-500/10' },
  error: { icon: XCircle, label: '错误', color: 'text-red-500 bg-red-500/10' },
  stopped: { icon: Square, label: '已停止', color: 'text-zinc-500 bg-zinc-500/10' },
};

function TaskMetadataInline({ task, onStatusChange, onOpenWorktree }: TaskMetadataInlineProps) {
  const config = statusConfig[task.status] || statusConfig.todo;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-3 p-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">状态</span>
        <div className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', config.color)}>
          <StatusIcon className="size-3" />
          {config.label}
        </div>
      </div>

      {/* Branch */}
      {task.branchName && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">分支</span>
          <div className="flex items-center gap-1.5 text-xs">
            <GitBranch className="text-muted-foreground size-3" />
            <code className="bg-muted rounded px-1.5 py-0.5">{task.branchName}</code>
          </div>
        </div>
      )}

      {/* Worktree */}
      {task.worktreePath && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">工作目录</span>
          {onOpenWorktree && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onOpenWorktree}>
              <ExternalLink className="mr-1 size-3" />
              打开
            </Button>
          )}
        </div>
      )}

      {/* Status Actions */}
      {onStatusChange && task.status !== 'done' && task.status !== 'completed' && (
        <div className="border-border/50 flex gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => onStatusChange('done')}
          >
            <CheckCircle className="mr-1 size-3" />
            标记完成
          </Button>
        </div>
      )}

      {/* Timestamps */}
      <div className="border-border/50 space-y-1.5 border-t pt-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">创建时间</span>
          <span>{new Date(task.createdAt).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">更新时间</span>
          <span>{new Date(task.updatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}