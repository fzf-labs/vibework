export interface CreateTaskOptions {
  title: string
  prompt: string
  taskMode: 'conversation' | 'workflow'
  projectId?: string
  projectPath?: string
  createWorktree?: boolean
  baseBranch?: string
  worktreeBranchPrefix?: string
  worktreeRootPath?: string
  cliToolId?: string
  agentToolConfigId?: string
  workflowTemplateId?: string
}

export interface TaskWithWorktree {
  id: string
  title: string
  prompt: string
  status: string
  taskMode: 'conversation' | 'workflow'
  projectId: string | null
  worktreePath: string | null
  branchName: string | null
  baseBranch: string | null
  workspacePath: string | null
  startedAt: string | null
  completedAt: string | null
  cost: number | null
  duration: number | null
  createdAt: string
  updatedAt: string
}
