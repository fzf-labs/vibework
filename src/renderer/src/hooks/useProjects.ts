import { useState, useEffect, useCallback } from 'react';

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  description?: string;
  config?: Record<string, unknown>;
}

const CURRENT_PROJECT_KEY = 'vibework_current_project';

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

  const setCurrentProjectId = useCallback((id: string | null) => {
    setCurrentProjectIdState(id);
    if (id) {
      localStorage.setItem(CURRENT_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  }, []);

  const addProject = useCallback(async (input: CreateProjectInput): Promise<Project> => {
    const result = await window.api.projects.add({
      ...input,
      config: {},
    }) as { success: boolean; error?: string; data: Project };
    if (!result.success) {
      throw new Error(result.error || '添加项目失败');
    }
    await fetchProjects();
    return result.data;
  }, [fetchProjects]);

  const updateProject = useCallback(
    async (id: string, updates: Partial<Project>): Promise<Project | null> => {
      const result = await window.api.projects.update(id, updates) as Project | null;
      await fetchProjects();
      return result;
    },
    [fetchProjects]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await window.api.projects.delete(id);
      if (result && currentProjectId === id) {
        setCurrentProjectId(null);
      }
      await fetchProjects();
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
    refresh: fetchProjects,
  };
}
