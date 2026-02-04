import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { useDashboardData } from '@/hooks/useDashboardData'
import { SummaryCards } from './components/SummaryCards'
import { ActivityList } from './components/ActivityList'
import { EmptyState } from './components/EmptyState'

export function DashboardPage() {
  const navigate = useNavigate()
  const { currentProject } = useProjects()

  const { tasks, summary, activityItems, loading } = useDashboardData(
    currentProject?.id
  )

  const hasTasks = tasks.length > 0

  const handleSelectActivity = (taskId: string) => {
    navigate(`/task/${taskId}`)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {currentProject ? currentProject.name : '全部项目'}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {!loading && !hasTasks && <EmptyState />}
        <SummaryCards counts={summary} loading={loading} />
        <ActivityList
          items={activityItems}
          loading={loading}
          onSelect={handleSelectActivity}
        />
      </div>
    </div>
  )
}
