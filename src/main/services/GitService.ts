import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface WorktreeInfo {
  path: string
  head?: string
  branch?: string
  detached?: boolean
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface FileDiff {
  oldPath: string
  newPath: string
  hunks: DiffHunk[]
  isBinary: boolean
  isNew: boolean
  isDeleted: boolean
  isRenamed: boolean
}

export class GitService {
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync('git --version')
      return true
    } catch {
      return false
    }
  }

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
    createBranch: boolean = true,
    baseBranch?: string
  ): Promise<void> {
    try {
      const command = createBranch
        ? `git -C "${repoPath}" worktree add -b "${branchName}" "${worktreePath}"${
            baseBranch ? ` "${baseBranch}"` : ''
          }`
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

  /**
   * 解析 diff 输出为结构化数据
   */
  parseDiff(diffOutput: string): FileDiff[] {
    const files: FileDiff[] = []
    const fileChunks = diffOutput.split(/^diff --git /m).filter((chunk) => chunk.trim())

    for (const chunk of fileChunks) {
      const lines = chunk.split('\n')
      const headerMatch = lines[0].match(/a\/(.+) b\/(.+)/)
      if (!headerMatch) continue

      const fileDiff: FileDiff = {
        oldPath: headerMatch[1],
        newPath: headerMatch[2],
        hunks: [],
        isBinary: chunk.includes('Binary files'),
        isNew: chunk.includes('new file mode'),
        isDeleted: chunk.includes('deleted file mode'),
        isRenamed: chunk.includes('rename from')
      }

      if (fileDiff.isBinary) {
        files.push(fileDiff)
        continue
      }

      // Parse hunks
      let currentHunk: DiffHunk | null = null
      let oldLineNum = 0
      let newLineNum = 0

      for (const line of lines) {
        const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
        if (hunkMatch) {
          if (currentHunk) {
            fileDiff.hunks.push(currentHunk)
          }
          oldLineNum = parseInt(hunkMatch[1], 10)
          newLineNum = parseInt(hunkMatch[3], 10)
          currentHunk = {
            oldStart: oldLineNum,
            oldLines: parseInt(hunkMatch[2] || '1', 10),
            newStart: newLineNum,
            newLines: parseInt(hunkMatch[4] || '1', 10),
            lines: []
          }
          continue
        }

        if (!currentHunk) continue

        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.lines.push({
            type: 'add',
            content: line.substring(1),
            newLineNumber: newLineNum++
          })
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.lines.push({
            type: 'delete',
            content: line.substring(1),
            oldLineNumber: oldLineNum++
          })
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push({
            type: 'context',
            content: line.substring(1),
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++
          })
        }
      }

      if (currentHunk) {
        fileDiff.hunks.push(currentHunk)
      }

      files.push(fileDiff)
    }

    return files
  }

  /**
   * 获取解析后的 diff 数据
   */
  async getParsedDiff(repoPath: string, filePath?: string): Promise<FileDiff[]> {
    const diffOutput = await this.getDiff(repoPath, filePath)
    return this.parseDiff(diffOutput)
  }

  /**
   * 获取解析后的已暂存 diff 数据
   */
  async getParsedStagedDiff(repoPath: string, filePath?: string): Promise<FileDiff[]> {
    const diffOutput = await this.getStagedDiff(repoPath, filePath)
    return this.parseDiff(diffOutput)
  }

  /**
   * 切换分支
   */
  async checkoutBranch(repoPath: string, branchName: string): Promise<void> {
    try {
      await execAsync(`git -C "${repoPath}" checkout "${branchName}"`)
    } catch (error) {
      throw new Error(`Failed to checkout branch: ${error}`)
    }
  }

  /**
   * 创建新分支
   */
  async createBranch(repoPath: string, branchName: string): Promise<void> {
    try {
      await execAsync(`git -C "${repoPath}" checkout -b "${branchName}"`)
    } catch (error) {
      throw new Error(`Failed to create branch: ${error}`)
    }
  }
}
