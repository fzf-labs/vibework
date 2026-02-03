import type { IpcModuleContext } from './types'

export const registerGitIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { gitService } = services

  handle('git:checkInstalled', [], async () => await gitService.isInstalled())

  handle('git:clone', [v.string(), v.string()], async (_, remoteUrl, targetPath) => {
    try {
      await gitService.clone(remoteUrl, targetPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  handle('git:init', [v.string()], async (_, path) => {
    await gitService.init(path)
  })

  handle('git:listWorktrees', [v.string()], async (_, repoPath) => {
    return await gitService.listWorktrees(repoPath)
  })

  handle(
    'git:addWorktree',
    [v.string(), v.string(), v.string(), v.boolean(), v.optional(v.string())],
    async (_, repoPath, worktreePath, branchName, createBranch, baseBranch) => {
      await gitService.addWorktree(repoPath, worktreePath, branchName, createBranch, baseBranch)
    }
  )

  handle(
    'git:removeWorktree',
    [v.string(), v.string(), v.boolean()],
    async (_, repoPath, worktreePath, force) => {
      await gitService.removeWorktree(repoPath, worktreePath, force)
    }
  )

  handle('git:pruneWorktrees', [v.string()], async (_, repoPath) => {
    await gitService.pruneWorktrees(repoPath)
  })

  handle('git:getDiff', [v.string(), v.optional(v.string())], async (_, repoPath, filePath) => {
    return await gitService.getDiff(repoPath, filePath)
  })

  handle(
    'git:getStagedDiff',
    [v.string(), v.optional(v.string())],
    async (_, repoPath, filePath) => {
      return await gitService.getStagedDiff(repoPath, filePath)
    }
  )

  handle('git:getBranches', [v.string()], async (_, repoPath) => {
    return await gitService.getBranches(repoPath)
  })

  handle('git:getCurrentBranch', [v.string()], async (_, repoPath) => {
    return await gitService.getCurrentBranch(repoPath)
  })

  handle('git:getChangedFiles', [v.string()], async (_, repoPath) => {
    return await gitService.getChangedFiles(repoPath)
  })

  handle(
    'git:getBranchDiffFiles',
    [v.string(), v.string(), v.optional(v.string())],
    async (_, repoPath, baseBranch, compareBranch) => {
      return await gitService.getBranchDiffFiles(repoPath, baseBranch, compareBranch)
    }
  )

  handle('git:stageFiles', [v.string(), v.array(v.string())], async (_, repoPath, filePaths) => {
    await gitService.stageFiles(repoPath, filePaths)
  })

  handle(
    'git:unstageFiles',
    [v.string(), v.array(v.string())],
    async (_, repoPath, filePaths) => {
      await gitService.unstageFiles(repoPath, filePaths)
    }
  )

  handle('git:mergeBranch', [v.string(), v.string()], async (_, repoPath, branchName) => {
    return await gitService.mergeBranch(repoPath, branchName)
  })

  handle('git:getConflictFiles', [v.string()], async (_, repoPath) => {
    return await gitService.getConflictFiles(repoPath)
  })

  handle('git:abortMerge', [v.string()], async (_, repoPath) => {
    await gitService.abortMerge(repoPath)
  })

  handle('git:getConflictContent', [v.string(), v.string()], async (_, repoPath, filePath) => {
    return await gitService.getConflictContent(repoPath, filePath)
  })

  handle(
    'git:resolveConflict',
    [v.string(), v.string(), v.enum(['ours', 'theirs'] as const)],
    async (_, repoPath, filePath, strategy) => {
      await gitService.resolveConflict(repoPath, filePath, strategy)
    }
  )

  handle('git:rebaseBranch', [v.string(), v.string()], async (_, repoPath, targetBranch) => {
    return await gitService.rebaseBranch(repoPath, targetBranch)
  })

  handle('git:rebaseContinue', [v.string()], async (_, repoPath) => {
    return await gitService.rebaseContinue(repoPath)
  })

  handle('git:rebaseAbort', [v.string()], async (_, repoPath) => {
    await gitService.rebaseAbort(repoPath)
  })

  handle('git:rebaseSkip', [v.string()], async (_, repoPath) => {
    return await gitService.rebaseSkip(repoPath)
  })

  handle('git:getRemoteUrl', [v.string(), v.optional(v.string())], async (_, repoPath, remoteName) => {
    return await gitService.getRemoteUrl(repoPath, remoteName)
  })

  handle(
    'git:pushBranch',
    [v.string(), v.string(), v.optional(v.string()), v.optional(v.boolean())],
    async (_, repoPath, branchName, remoteName, force) => {
      await gitService.pushBranch(repoPath, branchName, remoteName, force)
    }
  )

  handle('git:getCommitLog', [v.string(), v.optional(v.number({ min: 1 }))], async (_, repoPath, limit) => {
    return await gitService.getCommitLog(repoPath, limit)
  })

  handle('git:getParsedDiff', [v.string(), v.optional(v.string())], async (_, repoPath, filePath) => {
    return await gitService.getParsedDiff(repoPath, filePath)
  })

  handle(
    'git:getParsedStagedDiff',
    [v.string(), v.optional(v.string())],
    async (_, repoPath, filePath) => {
      return await gitService.getParsedStagedDiff(repoPath, filePath)
    }
  )

  handle('git:checkoutBranch', [v.string(), v.string()], async (_, repoPath, branchName) => {
    await gitService.checkoutBranch(repoPath, branchName)
  })

  handle('git:createBranch', [v.string(), v.string()], async (_, repoPath, branchName) => {
    await gitService.createBranch(repoPath, branchName)
  })
}
