import { useState, useEffect, useCallback } from 'react';

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  config: Record<string, unknown>;
  projectType: 'normal' | 'git';
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  description?: string;
  config?: Record<string, unknown>;
  projectType?: 'normal' | 'git';
}

const CURRENT_PROJECT_KEY = 'vibework_current_project';
const CURRENT_PROJECT_CHANGED_EVENT = 'current-project:changed';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(
    () => localStorage.getItem(CURRENT_PROJECT_KEY)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await window.api.projects.getAll() as Project[];
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const handleProjectsChanged = () => {
      fetchProjects();
    };
    window.addEventListener('projects:changed', handleProjectsChanged);
    return () => {
      window.removeEventListener('projects:changed', handleProjectsChanged);
    };
  }, [fetchProjects]);

  // Listen for current project changes from other components
  useEffect(() => {
    const handleCurrentProjectChanged = (event: Event) => {
      const customEvent = event as CustomEvent<string | null>;
      setCurrentProjectIdState(customEvent.detail);
    };
    window.addEventListener(CURRENT_PROJECT_CHANGED_EVENT, handleCurrentProjectChanged);
    return () => {
      window.removeEventListener(CURRENT_PROJECT_CHANGED_EVENT, handleCurrentProjectChanged);
    };
  }, []);

  const setCurrentProjectId = useCallback((id: string | null) => {
    setCurrentProjectIdState(id);
    if (id) {
      localStorage.setItem(CURRENT_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
    // Notify other components about the change
    window.dispatchEvent(new CustomEvent(CURRENT_PROJECT_CHANGED_EVENT, { detail: id }));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (projects.length === 0) return;
    const hasValidCurrent = currentProjectId
      ? projects.some((project) => project.id === currentProjectId)
      : false;
    if (!hasValidCurrent) {
      setCurrentProjectId(projects[0].id);
    }
  }, [loading, projects, currentProjectId, setCurrentProjectId]);

  const addProject = useCallback(async (input: CreateProjectInput): Promise<Project> => {
    const result = await window.api.projects.add({
      ...input,
      config: {},
      projectType: input.projectType,
    }) as { success: boolean; error?: string; data: Project };
    if (!result.success) {
      throw new Error(result.error || '添加项目失败');
    }
    await fetchProjects();
    window.dispatchEvent(new Event('projects:changed'));
    return result.data;
  }, [fetchProjects]);

  const updateProject = useCallback(
    async (id: string, updates: Partial<Project>): Promise<Project | null> => {
      const result = await window.api.projects.update(id, updates) as Project | null;
      await fetchProjects();
      window.dispatchEvent(new Event('projects:changed'));
      return result;
    },
    [fetchProjects]
  );

  const checkProjectPath = useCallback(
    async (
      id: string
    ): Promise<{ exists: boolean; projectType?: 'normal' | 'git'; updated: boolean }> => {
      return window.api.projects.checkPath(id) as Promise<{
        exists: boolean;
        projectType?: 'normal' | 'git';
        updated: boolean;
      }>;
    },
    []
  );

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await window.api.projects.delete(id);
      if (result && currentProjectId === id) {
        setCurrentProjectId(null);
      }
      await fetchProjects();
      window.dispatchEvent(new Event('projects:changed'));
      return result;
    },
    [fetchProjects, currentProjectId, setCurrentProjectId]
  );

  return {
    projects,
    currentProject,
    currentProjectId,
    loading,
    error,
    setCurrentProjectId,
    addProject,
    updateProject,
    deleteProject,
    checkProjectPath,
    refresh: fetchProjects,
  };
}
