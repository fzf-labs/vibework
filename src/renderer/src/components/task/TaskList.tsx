import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Play, CheckCircle, Clock, GitBranch, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Task {
  id: string
  sessionId: string
  taskIndex: number
  title: string
  prompt: string
  status: string
  projectId: string | null
  worktreePath: string | null
  branchName: string | null
  createdAt: string
  updatedAt: string
}

interface TaskListProps {
  projectId?: string
  onTaskSelect?: (task: Task) => void
  className?: string
}

const statusIcons = {
  todo: Clock,
  in_progress: Play,
  in_review: Clock,
  done: CheckCircle
}

const statusColors = {
  todo: 'text-zinc-400',
  in_progress: 'text-blue-500',
  in_review: 'text-amber-500',
  done: 'text-green-500'
}

function normalizeTaskStatus(status: string): keyof typeof statusIcons {
  if (['todo', 'in_progress', 'in_review', 'done'].includes(status)) {
    return status as keyof typeof statusIcons
  }
  return 'todo'
}

export function TaskList({ projectId, onTaskSelect, className }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const data = projectId
        ? await window.api.task.getByProject(projectId)
        : await window.api.task.getAll()
      setTasks(data)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await window.api.task.delete(taskId, true)
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-muted-foreground">No tasks yet</div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {tasks.map((task) => {
        const normalizedStatus = normalizeTaskStatus(task.status)
        const StatusIcon = statusIcons[normalizedStatus] || Clock
        const statusColor = statusColors[normalizedStatus] || 'text-zinc-400'

        return (
          <div
            key={task.id}
            onClick={() => onTaskSelect?.(task)}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
          >
            <StatusIcon className={cn('w-5 h-5 mt-0.5 shrink-0', statusColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title || task.prompt}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {task.branchName && (
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {task.branchName}
                  </span>
                )}
                <span>{new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => handleDelete(task.id, e)}
              className="shrink-0 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
