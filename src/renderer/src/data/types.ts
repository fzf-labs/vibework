// Database types for sessions, tasks and messages

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

// Session represents a conversation context that can contain multiple tasks
export interface Session {
  id: string; // ULID
  prompt: string; // Original prompt that started the session
  task_count: number; // Number of tasks in this session
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  session_id: string; // Reference to session
  task_index: number; // Index within session (1, 2, 3...)
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
  pipeline_template_id?: string | null; // Selected pipeline template
  workflow_id?: string | null; // Associated workflow instance
  created_at: string;
  updated_at: string;
}

export type MessageType =
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'result'
  | 'error'
  | 'user'
  | 'plan';

export interface Message {
  id: string;
  task_id: string;
  type: MessageType;
  content: string | null;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  tool_use_id: string | null;
  subtype: string | null;
  error_message: string | null;
  created_at: string;
}

// Input types for creating records
export interface CreateSessionInput {
  id: string;
  prompt: string;
}

export interface CreateTaskInput {
  id: string;
  session_id: string;
  task_index: number;
  title: string;
  prompt: string;
  project_id?: string | null;
  worktree_path?: string | null;
  branch_name?: string | null;
  base_branch?: string | null;
  workspace_path?: string | null;
  cli_tool_id?: string | null;
  pipeline_template_id?: string | null;
}

export interface CreateMessageInput {
  task_id: string;
  type: MessageType;
  content?: string;
  tool_name?: string;
  tool_input?: string;
  tool_output?: string;
  tool_use_id?: string;
  subtype?: string;
  error_message?: string;
}

export interface UpdateTaskInput {
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
  pipeline_template_id?: string | null;
}
