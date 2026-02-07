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
  sessionId: string | null
  title: string
  prompt: string
  status: string
  taskMode: 'conversation' | 'workflow'
  projectId: string | null
  worktreePath: string | null
  branchName: string | null
  baseBranch: string | null
  workspacePath: string | null
  cliToolId: string | null
  agentToolConfigId: string | null
  cost: number | null
  duration: number | null
  createdAt: string
  updatedAt: string
}
