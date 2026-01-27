import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface WorktreeInfo {
  path: string
  head?: string
  branch?: string
  detached?: boolean
}

export class GitManager {
  async clone(remoteUrl: string, targetPath: string): Promise<void> {
    try {
      await execAsync(`git clone ${remoteUrl} "${targetPath}"`)
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`)
    }
  }

  async init(path: string): Promise<void> {
    try {
      await execAsync(`git init "${path}"`)
    } catch (error) {
      throw new Error(`Failed to initialize repository: ${error}`)
    }
  }

  async getStatus(path: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git -C "${path}" status`)
      return stdout
    } catch (error) {
      throw new Error(`Failed to get git status: ${error}`)
    }
  }

  async getBranches(path: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git -C "${path}" branch --list`)
      return stdout
        .split('\n')
        .filter((b) => b.trim())
        .map((b) => b.replace('*', '').trim())
    } catch (error) {
      throw new Error(`Failed to get branches: ${error}`)
    }
  }

  async getCurrentBranch(path: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git -C "${path}" branch --show-current`)
      return stdout.trim()
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`)
    }
  }

  /**
   * 列出所有 worktree
   */
  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync(`git -C "${repoPath}" worktree list --porcelain`)
      const worktrees: WorktreeInfo[] = []
      const lines = stdout.split('\n')
      let current: Partial<WorktreeInfo> = {}

      const flushCurrent = (): void => {
        if (current.path) {
          worktrees.push({
            path: current.path,
            head: current.head,
            branch: current.branch,
            detached: current.detached
          })
        }
      }

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          flushCurrent()
          current = { path: line.substring(9) }
        } else if (line.startsWith('HEAD ')) {
          current.head = line.substring(5)
        } else if (line.startsWith('branch ')) {
          current.branch = line.substring(7)
        } else if (line === 'detached') {
          current.detached = true
        }
      }

      flushCurrent()

      return worktrees
    } catch (error) {
      throw new Error(`Failed to list worktrees: ${String(error)}`)
    }
  }

  /**
   * 创建新的 worktree
   */
  async addWorktree(
    repoPath: string,
    worktreePath: string,
    branchName: string,
    createBranch: boolean = true
  ): Promise<void> {
    try {
      const command = createBranch
        ? `git -C "${repoPath}" worktree add -b "${branchName}" "${worktreePath}"`
        : `git -C "${repoPath}" worktree add "${worktreePath}" "${branchName}"`

      await execAsync(command)
    } catch (error) {
      throw new Error(`Failed to add worktree: ${error}`)
    }
  }

  /**
   * 删除 worktree
   */
  async removeWorktree(
    repoPath: string,
    worktreePath: string,
    force: boolean = false
  ): Promise<void> {
    try {
      const command = force
        ? `git -C "${repoPath}" worktree remove --force "${worktreePath}"`
        : `git -C "${repoPath}" worktree remove "${worktreePath}"`

      await execAsync(command)
    } catch (error) {
      throw new Error(`Failed to remove worktree: ${error}`)
    }
  }

  /**
   * 清理已删除的 worktree 记录
   */
  async pruneWorktrees(repoPath: string): Promise<void> {
    try {
      await execAsync(`git -C "${repoPath}" worktree prune`)
    } catch (error) {
      throw new Error(`Failed to prune worktrees: ${error}`)
    }
  }

  /**
   * 获取文件差异
   */
  async getDiff(repoPath: string, filePath?: string): Promise<string> {
    try {
      const command = filePath
        ? `git -C "${repoPath}" diff "${filePath}"`
        : `git -C "${repoPath}" diff`
      const { stdout } = await execAsync(command)
      return stdout
    } catch (error) {
      throw new Error(`Failed to get diff: ${error}`)
    }
  }

  /**
   * 获取已暂存的文件差异
   */
  async getStagedDiff(repoPath: string, filePath?: string): Promise<string> {
    try {
      const command = filePath
        ? `git -C "${repoPath}" diff --staged "${filePath}"`
        : `git -C "${repoPath}" diff --staged`
      const { stdout } = await execAsync(command)
      return stdout
    } catch (error) {
      throw new Error(`Failed to get staged diff: ${error}`)
    }
  }

  /**
   * 获取变更文件列表(包含状态)
   */
  async getChangedFiles(repoPath: string): Promise<
    Array<{
      path: string
      status: string
      staged: boolean
    }>
  > {
    try {
      const { stdout } = await execAsync(`git -C "${repoPath}" status --porcelain`)
      const files = stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const status = line.substring(0, 2)
          const path = line.substring(3)
          const staged = status[0] !== ' ' && status[0] !== '?'
          return { path, status, staged }
        })
      return files
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error}`)
    }
  }

  /**
   * 暂存文件
   */
  async stageFiles(repoPath: string, filePaths: string[]): Promise<void> {
    try {
      const files = filePaths.map((f) => `"${f}"`).join(' ')
      await execAsync(`git -C "${repoPath}" add ${files}`)
    } catch (error) {
      throw new Error(`Failed to stage files: ${error}`)
    }
  }

  /**
   * 取消暂存文件
   */
  async unstageFiles(repoPath: string, filePaths: string[]): Promise<void> {
    try {
      const files = filePaths.map((f) => `"${f}"`).join(' ')
      await execAsync(`git -C "${repoPath}" reset HEAD ${files}`)
    } catch (error) {
      throw new Error(`Failed to unstage files: ${error}`)
    }
  }

  /**
   * 合并分支
   */
  async mergeBranch(
    repoPath: string,
    branchName: string
  ): Promise<{ success: boolean; conflicts?: string[] }> {
    try {
      await execAsync(`git -C "${repoPath}" merge "${branchName}"`)
      return { success: true }
    } catch (error) {
      const conflicts = await this.getConflictFiles(repoPath)
      if (conflicts.length > 0) {
        return { success: false, conflicts }
      }
      throw new Error(`Failed to merge branch: ${String(error)}`)
    }
  }

  /**
   * 获取冲突文件列表
   */
  async getConflictFiles(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git -C "${repoPath}" diff --name-only --diff-filter=U`)
      return stdout.split('\n').filter((f) => f.trim())
    } catch {
      return []
    }
  }

  /**
   * 中止合并
   */
  async abortMerge(repoPath: string): Promise<void> {
    try {
      await execAsync(`git -C "${repoPath}" merge --abort`)
    } catch (error) {
      throw new Error(`Failed to abort merge: ${error}`)
    }
  }

  /**
   * 获取冲突文件内容
   */
  async getConflictContent(repoPath: string, filePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`cat "${repoPath}/${filePath}"`)
      return stdout
    } catch (error) {
      throw new Error(`Failed to get conflict content: ${error}`)
    }
  }

  /**
   * 解决冲突(使用ours或theirs)
   */
  async resolveConflict(
    repoPath: string,
    filePath: string,
    strategy: 'ours' | 'theirs'
  ): Promise<void> {
    try {
      await execAsync(`git -C "${repoPath}" checkout --${strategy} "${filePath}"`)
      await execAsync(`git -C "${repoPath}" add "${filePath}"`)
    } catch (error) {
      throw new Error(`Failed to resolve conflict: ${error}`)
    }
  }

  /**
   * 开始rebase操作
   */
  async rebaseBranch(
    repoPath: string,
    targetBranch: string
  ): Promise<{ success: boolean; conflicts?: string[] }> {
    try {
      await execAsync(`git -C "${repoPath}" rebase "${targetBranch}"`)
      return { success: true }
    } catch (error) {
      const conflicts = await this.getConflictFiles(repoPath)
      if (conflicts.length > 0) {
        return { success: false, conflicts }
      }
      throw new Error(`Failed to rebase: ${String(error)}`)
    }
  }

  /**
   * 继续rebase
   */
  async rebaseContinue(repoPath: string): Promise<{ success: boolean; conflicts?: string[] }> {
    try {
      await execAsync(`git -C "${repoPath}" rebase --continue`)
      return { success: true }
    } catch (error) {
      const conflicts = await this.getConflictFiles(repoPath)
      if (conflicts.length > 0) {
        return { success: false, conflicts }
      }
      throw new Error(`Failed to continue rebase: ${String(error)}`)
    }
  }

  /**
   * 中止rebase
   */
  async rebaseAbort(repoPath: string): Promise<void> {
    try {
      await execAsync(`git -C "${repoPath}" rebase --abort`)
    } catch (error) {
      throw new Error(`Failed to abort rebase: ${error}`)
    }
  }

  /**
   * 跳过当前rebase提交
   */
  async rebaseSkip(repoPath: string): Promise<{ success: boolean; conflicts?: string[] }> {
    try {
      await execAsync(`git -C "${repoPath}" rebase --skip`)
      return { success: true }
    } catch (error) {
      const conflicts = await this.getConflictFiles(repoPath)
      if (conflicts.length > 0) {
        return { success: false, conflicts }
      }
      throw new Error(`Failed to skip rebase: ${String(error)}`)
    }
  }

  /**
   * 获取远程仓库URL
   */
  async getRemoteUrl(repoPath: string, remoteName: string = 'origin'): Promise<string> {
    try {
      const { stdout } = await execAsync(`git -C "${repoPath}" remote get-url ${remoteName}`)
      return stdout.trim()
    } catch (error) {
      throw new Error(`Failed to get remote URL: ${error}`)
    }
  }

  /**
   * 推送分支到远程
   */
  async pushBranch(
    repoPath: string,
    branchName: string,
    remoteName: string = 'origin',
    force: boolean = false
  ): Promise<void> {
    try {
      const command = force
        ? `git -C "${repoPath}" push --force ${remoteName} ${branchName}`
        : `git -C "${repoPath}" push -u ${remoteName} ${branchName}`
      await execAsync(command)
    } catch (error) {
      throw new Error(`Failed to push branch: ${error}`)
    }
  }

  /**
   * 获取提交日志
   */
  async getCommitLog(
    repoPath: string,
    limit: number = 10
  ): Promise<
    Array<{
      hash: string
      message: string
      author: string
      date: string
    }>
  > {
    try {
      const { stdout } = await execAsync(
        `git -C "${repoPath}" log --pretty=format:"%H|%s|%an|%ad" --date=short -n ${limit}`
      )
      const commits = stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, message, author, date] = line.split('|')
          return { hash, message, author, date }
        })
      return commits
    } catch (error) {
      throw new Error(`Failed to get commit log: ${error}`)
    }
  }
}
