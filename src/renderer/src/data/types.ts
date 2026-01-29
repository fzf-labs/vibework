// Database types for sessions, tasks and messages

// Execution status (CLI process state)
export type TaskExecutionStatus = 'running' | 'completed' | 'error' | 'stopped';

// Pipeline status (workflow state) - matches design.md
export type TaskPipelineStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

// Combined task status
export type TaskStatus = TaskExecutionStatus | TaskPipelineStatus;

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
  prompt: string;
  status: TaskStatus;
  cost: number | null;
  duration: number | null;
  favorite?: boolean; // Whether task is favorited
  project_id?: string | null; // Associated project
  worktree_path?: string | null; // Git worktree path for isolated work
  branch_name?: string | null; // Git branch name for this task
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
  attachments: string | null; // JSON string of MessageAttachment[]
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
  prompt: string;
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
  attachments?: string; // JSON string of MessageAttachment[]
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  cost?: number;
  duration?: number;
  prompt?: string;
  favorite?: boolean;
}

// Library file types
export type FileType =
  | 'image'
  | 'text'
  | 'code'
  | 'document'
  | 'website'
  | 'presentation'
  | 'spreadsheet'
  | 'websearch';

export interface LibraryFile {
  id: string;
  task_id: string;
  name: string;
  type: FileType;
  path: string;
  preview: string | null;
  thumbnail: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface CreateFileInput {
  task_id: string;
  name: string;
  type: FileType;
  path: string;
  preview?: string;
  thumbnail?: string;
}
