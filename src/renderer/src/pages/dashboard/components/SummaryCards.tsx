import { CheckCircle, Clock, Eye, Play } from 'lucide-react'
import type { TaskStatus } from '@/data/types'
import type { DashboardSummary } from '@/hooks/useDashboardData'
import { cn } from '@/lib/utils'

interface SummaryCardsProps {
  counts: DashboardSummary
  loading?: boolean
}

const statusCards: Array<{
  id: TaskStatus
  label: string
  icon: typeof Clock
  tone: string
  iconBg: string
}> = [
  {
    id: 'todo',
    label: '待办',
    icon: Clock,
    tone: 'text-zinc-500',
    iconBg: 'bg-zinc-100'
  },
  {
    id: 'in_progress',
    label: '进行中',
    icon: Play,
    tone: 'text-blue-500',
    iconBg: 'bg-blue-50'
  },
  {
    id: 'in_review',
    label: '审查中',
    icon: Eye,
    tone: 'text-amber-500',
    iconBg: 'bg-amber-50'
  },
  {
    id: 'done',
    label: '已完成',
    icon: CheckCircle,
    tone: 'text-green-500',
    iconBg: 'bg-green-50'
  }
]

export function SummaryCards({ counts, loading }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statusCards.map((card) => {
        const Icon = card.icon
        const value = loading ? '—' : counts[card.id]

        return (
          <div
            key={card.id}
            className="rounded-lg border bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{card.label}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </div>
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  card.iconBg
                )}
              >
                <Icon className={cn('h-5 w-5', card.tone)} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
