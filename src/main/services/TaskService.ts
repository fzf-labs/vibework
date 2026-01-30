import * as path from 'path'
import { DatabaseService } from './DatabaseService'
import { GitService } from './GitService'
import { newUlid } from '../utils/ids'

interface CreateTaskOptions {
  sessionId: string
  taskIndex: number
  title: string
  prompt: string
  projectId?: string
  projectPath?: string
  createWorktree?: boolean
  baseBranch?: string
  worktreeBranchPrefix?: string
  cliToolId?: string
  pipelineTemplateId?: string
}

interface TaskWithWorktree {
  id: string
  sessionId: string
  taskIndex: number
  title: string
  prompt: string
  status: string
  projectId: string | null
  worktreePath: string | null
  branchName: string | null
  baseBranch: string | null
  workspacePath: string | null
  cliToolId: string | null
  pipelineTemplateId: string | null
  cost: number | null
  duration: number | null
  favorite: boolean
  createdAt: string
  updatedAt: string
}

export class TaskService {
  private static readonly DEFAULT_WORKTREE_PREFIX = 'vw-'

  private db: DatabaseService
  private git: GitService

  constructor(db: DatabaseService, git: GitService) {
    this.db = db
    this.git = git
  }

  async createTask(options: CreateTaskOptions): Promise<TaskWithWorktree> {
    const taskId = newUlid()
    let worktreePath: string | null = null
    let branchName: string | null = null
    let baseBranch: string | null = null
    let workspacePath: string | null = options.projectPath || null

    if (!options.title?.trim()) {
      throw new Error('Task title is required')
    }

    if (options.createWorktree && options.projectPath) {
      if (!options.baseBranch) {
        throw new Error('Base branch is required for worktree creation')
      }
      try {
        baseBranch = options.baseBranch
        const prefix =
          options.worktreeBranchPrefix?.trim() || TaskService.DEFAULT_WORKTREE_PREFIX
        branchName = `${prefix}${taskId}`
        worktreePath = path.join(options.projectPath, '.worktrees', branchName)
        workspacePath = worktreePath

        await this.git.addWorktree(
          options.projectPath,
          worktreePath,
          branchName,
          true,
          baseBranch
        )
      } catch (error) {
        console.error('Failed to create worktree:', error)
        throw error
      }
    }

    const task = this.db.createTask({
      id: taskId,
      session_id: options.sessionId,
      task_index: options.taskIndex,
      title: options.title.trim(),
      prompt: options.prompt,
      project_id: options.projectId,
      worktree_path: worktreePath ?? undefined,
      branch_name: branchName ?? undefined,
      base_branch: baseBranch ?? undefined,
      workspace_path: workspacePath ?? undefined,
      cli_tool_id: options.cliToolId,
      pipeline_template_id: options.pipelineTemplateId
    })

    return this.mapTask(task)
  }

  getTask(id: string): TaskWithWorktree | null {
    const task = this.db.getTask(id)
    return task ? this.mapTask(task) : null
  }

  getAllTasks(): TaskWithWorktree[] {
    return this.db.getAllTasks().map((t) => this.mapTask(t))
  }

  getTasksBySessionId(sessionId: string): TaskWithWorktree[] {
    return this.db.getTasksBySessionId(sessionId).map((t) => this.mapTask(t))
  }

  getTasksByProjectId(projectId: string): TaskWithWorktree[] {
    return this.db.getTasksByProjectId(projectId).map((t) => this.mapTask(t))
  }

  updateTaskStatus(
    id: string,
    status: string
  ): TaskWithWorktree | null {
    const task = this.db.updateTask(id, { status })
    return task ? this.mapTask(task) : null
  }

  async deleteTask(id: string, removeWorktree = true): Promise<boolean> {
    const task = this.db.getTask(id)
    if (!task) return false

    if (removeWorktree && task.worktree_path) {
      try {
        const projectPath = path.dirname(path.dirname(task.worktree_path))
        await this.git.removeWorktree(projectPath, task.worktree_path, true)

        // 删除分支
        if (task.branch_name) {
          try {
            await this.git.deleteBranch(projectPath, task.branch_name, true)
          } catch (branchError) {
            console.error('Failed to delete branch:', branchError)
          }
        }
      } catch (error) {
        console.error('Failed to remove worktree:', error)
      }
    }

    return this.db.deleteTask(id)
  }

  private mapTask(task: any): TaskWithWorktree {
    return {
      id: task.id,
      sessionId: task.session_id,
      taskIndex: task.task_index,
      title: task.title ?? task.prompt,
      prompt: task.prompt,
      status: task.status,
      projectId: task.project_id,
      worktreePath: task.worktree_path,
      branchName: task.branch_name,
      baseBranch: task.base_branch ?? null,
      workspacePath: task.workspace_path ?? task.worktree_path ?? null,
      cliToolId: task.cli_tool_id ?? null,
      pipelineTemplateId: task.pipeline_template_id ?? null,
      cost: task.cost,
      duration: task.duration,
      favorite: task.favorite,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    }
  }
}
