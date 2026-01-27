import type { Project, CreateProjectInput } from './types';

const PROJECTS_KEY = 'vibework_projects';
const CURRENT_PROJECT_KEY = 'vibework_current_project';

// Get all projects from localStorage
export function getProjects(): Project[] {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save projects to localStorage
export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

// Get current project ID
export function getCurrentProjectId(): string | null {
  return localStorage.getItem(CURRENT_PROJECT_KEY);
}

// Set current project ID
export function setCurrentProjectId(projectId: string | null): void {
  if (projectId) {
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
  } else {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
}

// Create a new project
export function createProject(input: CreateProjectInput): Project {
  const projects = getProjects();
  const now = new Date().toISOString();

  const project: Project = {
    id: Date.now().toString(),
    name: input.name,
    path: input.path,
    description: input.description,
    created_at: now,
    updated_at: now,
  };

  projects.push(project);
  saveProjects(projects);

  return project;
}

// Delete a project
export function deleteProject(projectId: string): void {
  const projects = getProjects().filter((p) => p.id !== projectId);
  saveProjects(projects);

  if (getCurrentProjectId() === projectId) {
    setCurrentProjectId(null);
  }
}
