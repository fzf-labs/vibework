import { useState, useEffect, useCallback } from 'react'
import { projectService } from '@/services'
import type { NewProjectInput, Project, ProjectConfig } from '@/types'

interface UseProjectsResult {
  projects: Project[]
  activeProject: Project | null
  loading: boolean
  error: string | null
  loadProjects: () => Promise<void>
  addProject: (config: NewProjectInput) => Promise<Project>
  updateProject: (id: string, updates: Partial<ProjectConfig>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setActive: (id: string) => Promise<void>
}

export const useProjects = (): UseProjectsResult => {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await projectService.getAll()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadActiveProject = useCallback(async () => {
    try {
      const active = await projectService.getActive()
      setActiveProject(active)
    } catch (err) {
      console.error('加载活动项目失败:', err)
    }
  }, [])

  const addProject = useCallback(async (config: NewProjectInput) => {
    try {
      const newProject = await projectService.add(config)
      setProjects((prev) => [...prev, newProject])
      return newProject
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '添加项目失败')
    }
  }, [])

  const updateProject = useCallback(
    async (id: string, updates: Partial<ProjectConfig>) => {
      try {
        await projectService.update(id, updates)
        await loadProjects()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : '更新项目失败')
      }
    },
    [loadProjects]
  )

  const deleteProject = useCallback(async (id: string) => {
    try {
      await projectService.delete(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : '删除项目失败')
    }
  }, [])

  const setActive = useCallback(
    async (id: string) => {
      try {
        await projectService.setActive(id)
        await loadActiveProject()
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : '设置活动项目失败')
      }
    },
    [loadActiveProject]
  )

  useEffect(() => {
    loadProjects()
    loadActiveProject()
  }, [loadProjects, loadActiveProject])

  return {
    projects,
    activeProject,
    loading,
    error,
    loadProjects,
    addProject,
    updateProject,
    deleteProject,
    setActive
  }
}
