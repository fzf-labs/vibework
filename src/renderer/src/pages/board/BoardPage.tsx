import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GitBranch, Clock, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSettings } from '@/data/settings';
import { Button } from '@/components/ui/button';
import { CreateTaskDialog } from '@/components/task/CreateTaskDialog';
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
    case 'pending':
      return 'todo';
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
  const navigate = useNavigate();
  const { currentProject } = useProjects();
  const [tasks, setTasks] = useState<TaskWithWorktree[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<TaskWithWorktree | null>(null);

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

  // Handle task click - navigate to task detail page
  const handleTaskClick = (task: TaskWithWorktree) => {
    navigate(`/task/${task.id}`);
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

  // Open project in IDE
  const handleOpenInIDE = async () => {
    if (currentProject?.path) {
      try {
        const settings = getSettings();
        const editorType = settings.editor?.editorType ?? 'vscode';
        const customCommand = settings.editor?.customCommand?.trim();
        const defaultCommandMap: Record<string, string> = {
          vscode: 'code',
          cursor: 'cursor',
          antigravity: 'antigravity',
          webstorm: 'webstorm',
          idea: 'idea',
          goland: 'goland',
          xcode: 'xed',
        };
        let editorCommand: string | null = null;

        if (editorType === 'custom') {
          editorCommand = customCommand || null;
        } else if (window.api?.editor?.getAvailable) {
          const available = await window.api.editor.getAvailable();
          const editors = Array.isArray(available) ? available : [];
          const matched = editors.find((editor) => editor.type === editorType);
          editorCommand =
            matched?.path ??
            matched?.command ??
            editors[0]?.path ??
            editors[0]?.command ??
            null;
        }

        if (!editorCommand && editorType !== 'custom') {
          editorCommand = defaultCommandMap[editorType] ?? null;
        }

        if (editorCommand && window.api?.editor?.openProject) {
          try {
            console.log(
              '[BoardPage] Opening in editor with command:',
              editorCommand,
              currentProject.path
            );
            await window.api.editor.openProject(
              currentProject.path,
              editorCommand
            );
            return;
          } catch (openError) {
            console.error(
              '[BoardPage] Failed to open via editor command:',
              openError
            );
          }
        }

        await window.api.shell.openPath(currentProject.path);
      } catch (error) {
        console.error('Failed to open in IDE:', error);
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
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
        <div className="flex items-center gap-2">
          {currentProject?.path && (
            <Button variant="outline" onClick={handleOpenInIDE}>
              <FolderOpen className="mr-2 h-4 w-4" />
              IDE打开
            </Button>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建任务
          </Button>
        </div>
      </div>

      {/* Board - Full screen */}
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
          />
        ))}
      </div>

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
}: BoardColumnProps) {
  return (
    <div
      className={cn(
        'flex min-w-[240px] flex-1 flex-col rounded-lg border bg-muted/30',
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
  onDragStart: () => void;
  onClick: () => void;
}

function TaskCard({ task, onDragStart, onClick }: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md border bg-card p-3 shadow-sm',
        'transition-all hover:shadow-md hover:border-primary/50',
        'active:cursor-grabbing'
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
