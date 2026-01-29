import * as path from 'path'
import { DatabaseService } from './DatabaseService'
import { GitService } from './GitService'
import { newUlid } from '../utils/ids'

interface CreateTaskOptions {
  sessionId: string
  taskIndex: number
  prompt: string
  projectId?: string
  projectPath?: string
  createWorktree?: boolean
}

interface TaskWithWorktree {
  id: string
  sessionId: string
  taskIndex: number
  prompt: string
  status: string
  projectId: string | null
  worktreePath: string | null
  branchName: string | null
  cost: number | null
  duration: number | null
  favorite: boolean
  createdAt: string
  updatedAt: string
}

export class TaskService {
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

    if (options.createWorktree && options.projectPath) {
      branchName = `task-${taskId}`
      worktreePath = path.join(options.projectPath, '.worktrees', branchName)

      try {
        await this.git.addWorktree(
          options.projectPath,
          worktreePath,
          branchName,
          true
        )
      } catch (error) {
        console.error('Failed to create worktree:', error)
        worktreePath = null
        branchName = null
      }
    }

    const task = this.db.createTask({
      id: taskId,
      session_id: options.sessionId,
      task_index: options.taskIndex,
      prompt: options.prompt,
      project_id: options.projectId,
      worktree_path: worktreePath ?? undefined,
      branch_name: branchName ?? undefined
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
    status: 'pending' | 'running' | 'completed' | 'error' | 'stopped'
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
      prompt: task.prompt,
      status: task.status,
      projectId: task.project_id,
      worktreePath: task.worktree_path,
      branchName: task.branch_name,
      cost: task.cost,
      duration: task.duration,
      favorite: task.favorite,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    }
  }
}
