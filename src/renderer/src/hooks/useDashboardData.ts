import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TaskStatus } from '@/data/types'

export interface DashboardTask {
  id: string
  title: string
  prompt: string
  status: string
  projectId: string | null
  branchName?: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardSummary {
  todo: number
  in_progress: number
  in_review: number
  done: number
  cancelled: number
}

export interface DashboardActivityItem {
  id: string
  title: string
  prompt: string
  updatedAt: string
  status: TaskStatus
  displayStatus: TaskStatus
  branchName?: string | null
}

const STATUS_VALUES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'cancelled']

const emptySummary: DashboardSummary = {
  todo: 0,
  in_progress: 0,
  in_review: 0,
  done: 0,
  cancelled: 0
}

function normalizeStatus(value?: string | null): TaskStatus {
  if (value && STATUS_VALUES.includes(value as TaskStatus)) {
    return value as TaskStatus
  }
  return 'todo'
}

export function useDashboardData(projectId?: string | null) {
  const [tasks, setTasks] = useState<DashboardTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const data = projectId ? await window.api.task.getByProject(projectId) : await window.api.task.getAll()
      setTasks(Array.isArray(data) ? (data as DashboardTask[]) : [])
      setError(null)
    } catch (err) {
      console.error('Failed to load dashboard tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const summary = useMemo(() => {
    const next: DashboardSummary = { ...emptySummary }
    for (const task of tasks) {
      const status = normalizeStatus(task.status)
      next[status] += 1
    }
    return next
  }, [tasks])

  const recentTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime()
      const bTime = new Date(b.updatedAt).getTime()
      return bTime - aTime
    })
    return sorted.slice(0, 10)
  }, [tasks])

  const activityItems = useMemo(() => {
    return recentTasks.map((task) => {
      const taskStatus = normalizeStatus(task.status)
      return {
        id: task.id,
        title: task.title,
        prompt: task.prompt,
        updatedAt: task.updatedAt,
        status: taskStatus,
        displayStatus: taskStatus,
        branchName: task.branchName ?? null
      }
    })
  }, [recentTasks])

  return {
    tasks,
    summary,
    activityItems,
    loading,
    error,
    refresh: loadTasks
  }
}
