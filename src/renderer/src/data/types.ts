// Database types for tasks and workflows

// Task status (workflow state) - 4 standard states
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

// WorkNode status - 4 standard states
export type WorkNodeStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

// Agent execution status (CLI process state)
export type AgentExecutionStatus = 'idle' | 'running' | 'completed';

// Project represents a workspace/repository
export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  project_type: 'normal' | 'git';
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  description?: string;
  project_type?: 'normal' | 'git';
}

export interface Task {
  id: string;
  session_id: string; // UUID for CLI session
  title: string;
  prompt: string;
  status: TaskStatus;
  cost: number | null;
  duration: number | null;
  favorite?: boolean; // Whether task is favorited
  project_id?: string | null; // Associated project
  worktree_path?: string | null; // Git worktree path for isolated work
  branch_name?: string | null; // Git branch name for this task
  base_branch?: string | null; // Base branch used to create worktree
  workspace_path?: string | null; // Actual workspace path for the task
  cli_tool_id?: string | null; // Selected CLI tool id
  workflow_template_id?: string | null; // Selected workflow template
  created_at: string;
  updated_at: string;
}

// Input types for creating records
export interface CreateTaskInput {
  id: string;
  session_id: string; // UUID for CLI session
  title: string;
  prompt: string;
  project_id?: string | null;
  worktree_path?: string | null;
  branch_name?: string | null;
  base_branch?: string | null;
  workspace_path?: string | null;
  cli_tool_id?: string | null;
  workflow_template_id?: string | null;
}

export interface UpdateTaskInput {
  session_id?: string;
  title?: string;
  prompt?: string;
  status?: TaskStatus;
  cost?: number;
  duration?: number;
  favorite?: boolean;
  worktree_path?: string | null;
  branch_name?: string | null;
  base_branch?: string | null;
  workspace_path?: string | null;
  cli_tool_id?: string | null;
  workflow_template_id?: string | null;
}
