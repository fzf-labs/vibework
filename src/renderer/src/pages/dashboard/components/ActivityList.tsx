import { Clock, GitBranch } from 'lucide-react'
import type { DashboardActivityItem } from '@/hooks/useDashboardData'
import type { TaskStatus } from '@/data/types'
import { cn } from '@/lib/utils'

interface ActivityListProps {
  items: DashboardActivityItem[]
  loading?: boolean
  onSelect: (taskId: string) => void
}

const statusLabels: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  in_review: '审查中',
  done: '已完成',
  cancelled: '已取消'
}

const statusStyles: Record<TaskStatus, string> = {
  todo: 'bg-zinc-100 text-zinc-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-zinc-200 text-zinc-600'
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function ActivityList({ items, loading, onSelect }: ActivityListProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">最近活动</h2>
      </div>
      <div className="space-y-3 p-4">
        {loading ? (
          <div className="text-muted-foreground text-sm">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground text-sm">暂无最近活动</div>
        ) : (
          items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left',
                'transition-colors hover:bg-muted/40'
              )}
            >
              <div className="mt-1 h-2 w-2 rounded-full bg-primary/60" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {item.title || item.prompt}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      statusStyles[item.displayStatus]
                    )}
                  >
                    {statusLabels[item.displayStatus]}
                  </span>
                </div>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {item.branchName && (
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      <span className="max-w-[160px] truncate">
                        {item.branchName}
                      </span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(item.updatedAt)}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
