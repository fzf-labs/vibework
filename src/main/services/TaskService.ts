import * as path from 'path'
import { mkdirSync } from 'fs'
import { realpath, rm } from 'fs/promises'
import { homedir } from 'os'
import { DatabaseService } from './DatabaseService'
import { GitService } from './GitService'
import { newUlid } from '../utils/ids'
import { getAppPaths } from '../app/AppPaths'
import type { CreateTaskOptions, TaskWithWorktree } from '../types/domain/task'
import type { TaskStatus } from '../types/task'

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
        const prefix = options.worktreeBranchPrefix?.trim() || TaskService.DEFAULT_WORKTREE_PREFIX
        branchName = `${prefix}${taskId}`
        const projectKey = options.projectId || 'project'
        const worktreesRoot = path.join(this.resolveWorktreeRoot(options.worktreeRootPath), projectKey)
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

    if (options.taskMode === 'conversation' && !options.cliToolId) {
      throw new Error('CLI tool is required for conversation tasks')
    }

    if (options.taskMode === 'workflow' && !options.workflowTemplateId) {
      throw new Error('Workflow template is required for workflow tasks')
    }

    let agentToolConfigId = options.agentToolConfigId
    if (!agentToolConfigId && options.cliToolId) {
      const defaultConfig = this.db.getDefaultAgentToolConfig(options.cliToolId)
      if (defaultConfig?.id) {
        agentToolConfigId = defaultConfig.id
      }
    }

    const task = this.db.createTask({
      id: taskId,
      title: options.title.trim(),
      prompt: options.prompt,
      task_mode: options.taskMode,
      project_id: options.projectId,
      worktree_path: worktreePath ?? undefined,
      branch_name: branchName ?? undefined,
      base_branch: baseBranch ?? undefined,
      workspace_path: workspacePath ?? undefined
    })

    if (options.taskMode === 'conversation') {
      this.db.updateCurrentTaskNodeRuntime(taskId, {
        cli_tool_id: options.cliToolId ?? null,
        agent_tool_config_id: agentToolConfigId ?? null
      })
    }

    if (options.taskMode === 'workflow' && options.workflowTemplateId) {
      this.db.createTaskNodesFromTemplate(taskId, options.workflowTemplateId, {
        cliToolId: options.cliToolId ?? null,
        agentToolConfigId: agentToolConfigId ?? null
      })
    }

    return this.mapTask(this.db.getTask(taskId) ?? task)
  }

  getTask(id: string): TaskWithWorktree | null {
    const task = this.db.getTask(id)
    return task ? this.mapTask(task) : null
  }

  getAllTasks(): TaskWithWorktree[] {
    return this.db.getAllTasks().map((task) => this.mapTask(task))
  }

  getTasksByProjectId(projectId: string): TaskWithWorktree[] {
    return this.db.getTasksByProjectId(projectId).map((task) => this.mapTask(task))
  }

  updateTaskStatus(id: string, status: TaskStatus): TaskWithWorktree | null {
    const task = this.db.updateTask(id, { status })
    return task ? this.mapTask(task) : null
  }

  async deleteTask(id: string, removeWorktree = true): Promise<boolean> {
    const task = this.db.getTask(id)
    if (!task) return false

    if (removeWorktree && (task.worktree_path || task.branch_name)) {
      try {
        const normalizePath = async (value: string): Promise<string> => {
          const resolved = path.resolve(value)
          try {
            return await realpath(resolved)
          } catch {
            return resolved
          }
        }

        let projectPath: string | null = null
        if (task.project_id) {
          const project = this.db.getProject(task.project_id)
          projectPath = project?.path ?? null
        }
        if (!projectPath && task.worktree_path) {
          projectPath = await this.git.inferRepoPathFromWorktree(task.worktree_path)
        }

        if (!projectPath) {
          if (task.worktree_path) {
            try {
              await rm(task.worktree_path, { recursive: true, force: true })
            } catch (fsError) {
              console.error('Failed to remove worktree directory:', fsError)
            }
          }
        } else {
          const repoPath = await normalizePath(projectPath)
          const worktrees = await this.git.listWorktrees(projectPath).catch((error) => {
            console.error('Failed to list worktrees:', error)
            return []
          })
          const branchRef = task.branch_name ? `refs/heads/${task.branch_name}` : null
          const pathsToRemove = new Set<string>()

          if (task.worktree_path) {
            pathsToRemove.add(task.worktree_path)
          }
          if (branchRef) {
            for (const worktree of worktrees) {
              if (worktree.branch === branchRef && worktree.path) {
                pathsToRemove.add(worktree.path)
              }
            }
          }

          for (const candidatePath of pathsToRemove) {
            const resolvedPath = path.isAbsolute(candidatePath)
              ? candidatePath
              : path.resolve(projectPath, candidatePath)
            const normalizedPath = await normalizePath(resolvedPath)
            if (normalizedPath === repoPath) continue

            try {
              await this.git.removeWorktree(projectPath, resolvedPath, true)
            } catch (error) {
              console.error('Failed to remove worktree:', error)
              try {
                await rm(resolvedPath, { recursive: true, force: true })
              } catch (fsError) {
                console.error('Failed to remove worktree directory:', fsError)
              }
            }
          }

          try {
            await this.git.pruneWorktrees(projectPath)
          } catch (error) {
            console.error('Failed to prune worktrees:', error)
          }

          if (task.branch_name) {
            try {
              await this.git.deleteBranch(projectPath, task.branch_name, true)
            } catch (branchError) {
              console.error('Failed to delete branch:', branchError)
            }
          }
        }
      } catch (error) {
        console.error('Failed to remove worktree:', error)
      }
    }

    const appPaths = getAppPaths()
    try {
      const sessionDir = appPaths.getTaskDataDir(task.id, task.project_id)
      const sessionLog = appPaths.getTaskMessagesFile(task.id, task.project_id)
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
      title: task.title ?? task.prompt,
      prompt: task.prompt,
      status: task.status,
      taskMode: task.task_mode ?? 'conversation',
      projectId: task.project_id ?? null,
      worktreePath: task.worktree_path ?? null,
      branchName: task.branch_name ?? null,
      baseBranch: task.base_branch ?? null,
      workspacePath: task.workspace_path ?? task.worktree_path ?? null,
      startedAt: task.started_at ?? null,
      completedAt: task.completed_at ?? null,
      cost: task.cost ?? null,
      duration: task.duration ?? null,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    }
  }
}
