import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerGitIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { gitService } = services

  handle(IPC_CHANNELS.git.checkInstalled, [], async () => await gitService.isInstalled())

  handle(IPC_CHANNELS.git.clone, [v.string(), v.string()], async (_, remoteUrl, targetPath) => {
    try {
      await gitService.clone(remoteUrl, targetPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  handle(IPC_CHANNELS.git.init, [v.string()], async (_, path) => {
    await gitService.init(path)
  })

  handle(IPC_CHANNELS.git.listWorktrees, [v.string()], async (_, repoPath) => {
    return await gitService.listWorktrees(repoPath)
  })

  handle(
    IPC_CHANNELS.git.addWorktree,
    [v.string(), v.string(), v.string(), v.boolean(), v.optional(v.string())],
    async (_, repoPath, worktreePath, branchName, createBranch, baseBranch) => {
      await gitService.addWorktree(repoPath, worktreePath, branchName, createBranch, baseBranch)
    }
  )

  handle(
    IPC_CHANNELS.git.removeWorktree,
    [v.string(), v.string(), v.boolean()],
    async (_, repoPath, worktreePath, force) => {
      await gitService.removeWorktree(repoPath, worktreePath, force)
    }
  )

  handle(IPC_CHANNELS.git.pruneWorktrees, [v.string()], async (_, repoPath) => {
    await gitService.pruneWorktrees(repoPath)
  })

  handle(IPC_CHANNELS.git.getDiff, [v.string(), v.optional(v.string())], async (_, repoPath, filePath) => {
    return await gitService.getDiff(repoPath, filePath)
  })

  handle(
    IPC_CHANNELS.git.getStagedDiff,
    [v.string(), v.optional(v.string())],
    async (_, repoPath, filePath) => {
      return await gitService.getStagedDiff(repoPath, filePath)
    }
  )

  handle(IPC_CHANNELS.git.getBranches, [v.string()], async (_, repoPath) => {
    return await gitService.getBranches(repoPath)
  })

  handle(IPC_CHANNELS.git.getCurrentBranch, [v.string()], async (_, repoPath) => {
    return await gitService.getCurrentBranch(repoPath)
  })

  handle(IPC_CHANNELS.git.getChangedFiles, [v.string()], async (_, repoPath) => {
    return await gitService.getChangedFiles(repoPath)
  })

  handle(
    IPC_CHANNELS.git.getBranchDiffFiles,
    [v.string(), v.string(), v.optional(v.string())],
    async (_, repoPath, baseBranch, compareBranch) => {
      return await gitService.getBranchDiffFiles(repoPath, baseBranch, compareBranch)
    }
  )

  handle(IPC_CHANNELS.git.stageFiles, [v.string(), v.array(v.string())], async (_, repoPath, filePaths) => {
    await gitService.stageFiles(repoPath, filePaths)
  })

  handle(
    IPC_CHANNELS.git.unstageFiles,
    [v.string(), v.array(v.string())],
    async (_, repoPath, filePaths) => {
      await gitService.unstageFiles(repoPath, filePaths)
    }
  )

  handle(IPC_CHANNELS.git.mergeBranch, [v.string(), v.string()], async (_, repoPath, branchName) => {
    return await gitService.mergeBranch(repoPath, branchName)
  })

  handle(IPC_CHANNELS.git.getConflictFiles, [v.string()], async (_, repoPath) => {
    return await gitService.getConflictFiles(repoPath)
  })

  handle(IPC_CHANNELS.git.abortMerge, [v.string()], async (_, repoPath) => {
    await gitService.abortMerge(repoPath)
  })

  handle(
    IPC_CHANNELS.git.getConflictContent,
    [v.string(), v.string()],
    async (_, repoPath, filePath) => {
    return await gitService.getConflictContent(repoPath, filePath)
  })

  handle(
    IPC_CHANNELS.git.resolveConflict,
    [v.string(), v.string(), v.enum(['ours', 'theirs'] as const)],
    async (_, repoPath, filePath, strategy) => {
      await gitService.resolveConflict(repoPath, filePath, strategy)
    }
  )

  handle(IPC_CHANNELS.git.rebaseBranch, [v.string(), v.string()], async (_, repoPath, targetBranch) => {
    return await gitService.rebaseBranch(repoPath, targetBranch)
  })

  handle(IPC_CHANNELS.git.rebaseContinue, [v.string()], async (_, repoPath) => {
    return await gitService.rebaseContinue(repoPath)
  })

  handle(IPC_CHANNELS.git.rebaseAbort, [v.string()], async (_, repoPath) => {
    await gitService.rebaseAbort(repoPath)
  })

  handle(IPC_CHANNELS.git.rebaseSkip, [v.string()], async (_, repoPath) => {
    return await gitService.rebaseSkip(repoPath)
  })

  handle(
    IPC_CHANNELS.git.getRemoteUrl,
    [v.string(), v.optional(v.string())],
    async (_, repoPath, remoteName) => {
    return await gitService.getRemoteUrl(repoPath, remoteName)
  })

  handle(
    IPC_CHANNELS.git.pushBranch,
    [v.string(), v.string(), v.optional(v.string()), v.optional(v.boolean())],
    async (_, repoPath, branchName, remoteName, force) => {
      await gitService.pushBranch(repoPath, branchName, remoteName, force)
    }
  )

  handle(
    IPC_CHANNELS.git.getCommitLog,
    [v.string(), v.optional(v.number({ min: 1 }))],
    async (_, repoPath, limit) => {
    return await gitService.getCommitLog(repoPath, limit)
  })

  handle(
    IPC_CHANNELS.git.getParsedDiff,
    [v.string(), v.optional(v.string())],
    async (_, repoPath, filePath) => {
    return await gitService.getParsedDiff(repoPath, filePath)
  })

  handle(
    IPC_CHANNELS.git.getParsedStagedDiff,
    [v.string(), v.optional(v.string())],
    async (_, repoPath, filePath) => {
      return await gitService.getParsedStagedDiff(repoPath, filePath)
    }
  )

  handle(IPC_CHANNELS.git.checkoutBranch, [v.string(), v.string()], async (_, repoPath, branchName) => {
    await gitService.checkoutBranch(repoPath, branchName)
  })

  handle(IPC_CHANNELS.git.createBranch, [v.string(), v.string()], async (_, repoPath, branchName) => {
    await gitService.createBranch(repoPath, branchName)
  })
}
