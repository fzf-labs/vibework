import * as path from 'path'
import { mkdirSync } from 'fs'
import { rm } from 'fs/promises'
import { homedir } from 'os'
import { DatabaseService } from './DatabaseService'
import { GitService } from './GitService'
import { newUlid, newUuid } from '../utils/ids'
import { getAppPaths } from '../app/AppPaths'
import type { CreateTaskOptions, TaskWithWorktree } from '../types/domain/task'

export class TaskService {
  private static readonly DEFAULT_WORKTREE_PREFIX = 'VW-'

  private db: DatabaseService
  private git: GitService

  constructor(db: DatabaseService, git: GitService) {
    this.db = db
    this.git = git
  }

  private resolveWorktreeRoot(pathInput?: string): string {
    const appPaths = getAppPaths()
    const fallback = appPaths.getWorktreesDir()
    if (!pathInput?.trim()) return fallback
    const trimmed = pathInput.trim()
    const resolved = trimmed.replace(/^~(?=\/|\\|$)/, homedir())
    return resolved || fallback
  }

  async createTask(options: CreateTaskOptions): Promise<TaskWithWorktree> {
    const taskId = newUlid()
    const sessionId = newUuid()
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
        const projectKey = options.projectId || 'project'
        const worktreesRoot = path.join(
          this.resolveWorktreeRoot(options.worktreeRootPath),
          projectKey
        )
        mkdirSync(worktreesRoot, { recursive: true })
        worktreePath = path.join(worktreesRoot, branchName)
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
      session_id: sessionId,
      title: options.title.trim(),
      prompt: options.prompt,
      project_id: options.projectId,
      worktree_path: worktreePath ?? undefined,
      branch_name: branchName ?? undefined,
      base_branch: baseBranch ?? undefined,
      workspace_path: workspacePath ?? undefined,
      cli_tool_id: options.cliToolId,
      workflow_template_id: options.workflowTemplateId
    })

    if (options.workflowTemplateId) {
      try {
        this.db.seedWorkflowForTask(taskId, options.workflowTemplateId)
      } catch (error) {
        console.error('Failed to seed workflow for task:', error)
      }
    }

    return this.mapTask(task)
  }

  getTask(id: string): TaskWithWorktree | null {
    const task = this.db.getTask(id)
    return task ? this.mapTask(task) : null
  }

  getTaskBySessionId(sessionId: string): TaskWithWorktree | null {
    const task = this.db.getTaskBySessionId(sessionId)
    return task ? this.mapTask(task) : null
  }

  getAllTasks(): TaskWithWorktree[] {
    return this.db.getAllTasks().map((t) => this.mapTask(t))
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
        let projectPath: string | null = null
        if (task.project_id) {
          const project = this.db.getProject(task.project_id)
          projectPath = project?.path ?? null
        }
        if (!projectPath) {
          projectPath = await this.git.inferRepoPathFromWorktree(task.worktree_path)
        }
        if (!projectPath) {
          throw new Error('Failed to determine repository path for worktree removal')
        }
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

    const appPaths = getAppPaths()
    try {
      const sessionDir = appPaths.getSessionDataDir(task.session_id, task.project_id)
      const sessionLog = appPaths.getSessionMessagesFile(task.session_id, task.project_id)
      await rm(sessionDir, { recursive: true, force: true })
      await rm(sessionLog, { force: true })
    } catch (error) {
      console.error('[TaskService] Failed to remove session directory:', error)
    }

    return this.db.deleteTask(id)
  }

  private mapTask(task: any): TaskWithWorktree {
    return {
      id: task.id,
      sessionId: task.session_id,
      title: task.title ?? task.prompt,
      prompt: task.prompt,
      status: task.status,
      projectId: task.project_id,
      worktreePath: task.worktree_path,
      branchName: task.branch_name,
      baseBranch: task.base_branch ?? null,
      workspacePath: task.workspace_path ?? task.worktree_path ?? null,
      cliToolId: task.cli_tool_id ?? null,
      workflowTemplateId: task.workflow_template_id ?? null,
      cost: task.cost,
      duration: task.duration,
      favorite: task.favorite,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    }
  }
}
