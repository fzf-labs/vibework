import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { GitBranch } from 'lucide-react'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  projectPath?: string
  sessionId: string
  onTaskCreated?: (task: any) => void
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  projectPath,
  sessionId,
  onTaskCreated
}: CreateTaskDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [createWorktree, setCreateWorktree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await window.api.task.create({
        sessionId,
        taskIndex: Date.now(),
        prompt: prompt.trim(),
        projectId,
        projectPath,
        createWorktree: createWorktree && !!projectPath
      })

      if (result.success && result.data) {
        onTaskCreated?.(result.data)
        setPrompt('')
        setCreateWorktree(false)
        onOpenChange(false)
      } else {
        setError(result.error || 'Failed to create task')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Task Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to accomplish..."
              className={cn(
                'mt-1.5 w-full min-h-[100px] px-3 py-2 text-sm',
                'bg-background border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
              autoFocus
            />
          </div>

          {projectPath && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createWorktree}
                onChange={(e) => setCreateWorktree(e.target.checked)}
                className="rounded"
              />
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Create isolated worktree</span>
            </label>
          )}

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
