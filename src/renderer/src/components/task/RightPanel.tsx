import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, GitBranch, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/providers/language-provider';
import type { Artifact } from '@/components/artifacts';
import { GitDiffView } from '@/components/git';
import { shell } from '@/lib/electron-api';
import { TerminalPanel } from '@/components/terminal';
import { FileListPanel } from './FileListPanel';

export type RightPanelTab = 'files' | 'git' | 'terminal';

interface RightPanelProps {
  taskId: string | null;
  workingDir: string | null;
  branchName?: string | null;
  baseBranch?: string | null;
  selectedArtifact: Artifact | null;
  onSelectArtifact: (artifact: Artifact | null) => void;
  workspaceRefreshToken?: number;
  // File preview component
  renderFilePreview: () => React.ReactNode;
}

export function RightPanel({
  taskId,
  workingDir,
  branchName,
  baseBranch,
  selectedArtifact,
  onSelectArtifact,
  workspaceRefreshToken,
  renderFilePreview,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('files');
  const [hasOpenedTerminal, setHasOpenedTerminal] = useState(false);
  const [terminalOpenRequestId, setTerminalOpenRequestId] = useState(0);
  const { t } = useLanguage();
  const handleSelectArtifact = useCallback(
    (artifact: Artifact) => {
      onSelectArtifact(artifact);
    },
    [onSelectArtifact]
  );

  const tabs: { id: RightPanelTab; label: string; icon: typeof FileText }[] = [
    { id: 'files', label: t.preview.filesTab, icon: FileText },
    { id: 'git', label: t.preview.gitTab, icon: GitBranch },
    { id: 'terminal', label: t.preview.terminalTab, icon: Terminal },
  ];

  const handleTabChange = useCallback((tab: RightPanelTab) => {
    setActiveTab(tab);
    if (tab === 'terminal') {
      setHasOpenedTerminal(true);
      setTerminalOpenRequestId((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'terminal' && !hasOpenedTerminal) {
      setHasOpenedTerminal(true);
    }
  }, [activeTab, hasOpenedTerminal]);

  return (
    <div className="flex h-full flex-col">
      {/* Tab Bar */}
      <div className="border-b px-4 py-2">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange(tab.id)}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <div className="flex h-full min-w-0">
            <FileListPanel
              workingDir={workingDir}
              branchName={branchName}
              selectedArtifact={selectedArtifact}
              onSelectArtifact={handleSelectArtifact}
              refreshToken={workspaceRefreshToken}
            />
            <div className="min-w-0 flex-1">{renderFilePreview()}</div>
          </div>
        )}

        {activeTab === 'git' && (
          <GitPanel workingDir={workingDir} baseBranch={baseBranch} />
        )}

        {hasOpenedTerminal && (
          <div className={cn('h-full', activeTab !== 'terminal' && 'hidden')}>
            <TerminalPanel
              taskId={taskId}
              workingDir={workingDir}
              isActive={activeTab === 'terminal'}
              openRequestId={terminalOpenRequestId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Git Panel Component
interface GitPanelProps {
  workingDir: string | null;
  baseBranch?: string | null;
}

type GitSubTab = 'changes' | 'compare';

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
}

interface WorktreeInfo {
  path: string;
  head?: string;
  branch?: string;
  detached?: boolean;
}

interface BranchDiffFile {
  path: string;
  status: string;
}

type RepoStatus =
  | 'idle'
  | 'checking'
  | 'no-working-dir'
  | 'git-unavailable'
  | 'not-repo'
  | 'ready'
  | 'error';

function unwrapResult<T>(result: any): { ok: boolean; data?: T; error?: string } {
  if (result === null || result === undefined) {
    return { ok: false, error: 'API 不可用' };
  }
  if (typeof result === 'object' && 'success' in result) {
    return (result as { success: boolean; data?: T; error?: string }).success
      ? { ok: true, data: (result as { data?: T }).data }
      : { ok: false, error: (result as { error?: string }).error || '未知错误' };
  }
  return { ok: true, data: result as T };
}

function formatError(error?: string | null) {
  if (!error) return '未知错误';
  return error.replace(/^Error:\s*/i, '');
}

function getStatusCode(status: string) {
  const normalized = status.trim();
  if (!normalized) return '?';
  if (normalized.includes('?')) return '?';
  if (normalized.includes('R')) return 'R';
  if (normalized.includes('D')) return 'D';
  if (normalized.includes('A')) return 'A';
  if (normalized.includes('M')) return 'M';
  return '?';
}

function hasUnstagedStatus(status: string) {
  if (!status) return false;
  const worktreeStatus = status[1] ?? ' ';
  return worktreeStatus !== ' ';
}

function parseRemoteUrl(remoteUrl: string): { host: string; path: string; protocol: string } | null {
  const trimmed = remoteUrl.trim().replace(/\.git$/i, '');
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('ssh://')) {
    try {
      const url = new URL(trimmed);
      return {
        host: url.host,
        path: url.pathname.replace(/^\/+/, ''),
        protocol: url.protocol.replace(':', '') || 'https',
      };
    } catch {
      return null;
    }
  }

  const scpMatch = trimmed.match(/^(?:[^@]+@)?([^:]+):(.+)$/);
  if (scpMatch) {
    return { host: scpMatch[1], path: scpMatch[2], protocol: 'https' };
  }

  return null;
}

function buildRepositoryUrl(remoteUrl: string): string | null {
  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) return null;
  const protocol = parsed.protocol === 'http' ? 'http' : 'https';
  return `${protocol}://${parsed.host}/${parsed.path}`;
}

function buildPullRequestUrl(remoteUrl: string, baseBranch: string, headBranch: string): string | null {
  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) return null;
  const repoUrl = buildRepositoryUrl(remoteUrl);
  if (!repoUrl) return null;

  const base = encodeURIComponent(baseBranch);
  const head = encodeURIComponent(headBranch);
  const host = parsed.host.toLowerCase();

  if (host.includes('github.com')) {
    return `${repoUrl}/compare/${base}...${head}?expand=1`;
  }
  if (host.includes('gitlab')) {
    return `${repoUrl}/-/merge_requests/new?merge_request[source_branch]=${head}&merge_request[target_branch]=${base}`;
  }
  if (host.includes('bitbucket')) {
    return `${repoUrl}/pull-requests/new?source=${head}&dest=${base}`;
  }
  return null;
}

function formatConflictMessage(actionLabel: string, conflicts?: string[]) {
  if (!conflicts || conflicts.length === 0) {
    return `${actionLabel}发生冲突，请先处理冲突。`;
  }
  const preview = conflicts.slice(0, 3).join(', ');
  const suffix = conflicts.length > 3 ? ` 等 ${conflicts.length} 个文件` : '';
  return `${actionLabel}产生冲突：${preview}${suffix}`;
}

function GitPanel({ workingDir, baseBranch }: GitPanelProps) {
  const [subTab, setSubTab] = useState<GitSubTab>('changes');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepoStatus>('idle');
  const [repoError, setRepoError] = useState<string | null>(null);
  const [changesLoading, setChangesLoading] = useState(false);
  const [branchDiffLoading, setBranchDiffLoading] = useState(false);
  const [branchDiffDetailLoading, setBranchDiffDetailLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [branchDiffError, setBranchDiffError] = useState<string | null>(null);
  const [branchDiffDetailError, setBranchDiffDetailError] = useState<string | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [fileActions, setFileActions] = useState<Record<string, boolean>>({});
  const [bulkStageLoading, setBulkStageLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitLoading, setCommitLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'merge' | 'pr' | 'rebase' | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [branchDiffFiles, setBranchDiffFiles] = useState<BranchDiffFile[]>([]);
  const [branchDiffSelectedPath, setBranchDiffSelectedPath] = useState<string | null>(null);
  const [branchDiffText, setBranchDiffText] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [diffText, setDiffText] = useState('');
  const [stagedDiffText, setStagedDiffText] = useState('');

  const gitApi = window.api?.git;

  const ensureRepoReady = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!workingDir) {
      setRepoStatus('no-working-dir');
      setRepoError(null);
      return false;
    }
    if (!gitApi) {
      setRepoStatus('error');
      setRepoError('Git API 未就绪');
      return false;
    }
    if (!force) {
      if (repoStatus === 'ready') return true;
      if (['checking', 'no-working-dir', 'git-unavailable', 'not-repo', 'error'].includes(repoStatus)) {
        return false;
      }
    }
    setRepoStatus('checking');
    setRepoError(null);

    const installedResult = unwrapResult<boolean>(await gitApi.checkInstalled());
    if (!installedResult.ok || installedResult.data === false) {
      setRepoStatus('git-unavailable');
      setRepoError(formatError(installedResult.error) || 'Git 不可用');
      return false;
    }

    const branchResult = unwrapResult<string>(await gitApi.getCurrentBranch(workingDir));
    if (!branchResult.ok) {
      const errorMessage = formatError(branchResult.error);
      const normalized = errorMessage.toLowerCase();
      const isNotRepo =
        normalized.includes('not a git repository') ||
        normalized.includes('not a git repo') ||
        normalized.includes('不是 git 仓库');
      setRepoStatus(isNotRepo ? 'not-repo' : 'error');
      setRepoError(errorMessage || '无法读取 Git 仓库');
      return false;
    }
    setCurrentBranch(branchResult.data || null);
    setRepoStatus('ready');
    return true;
  }, [gitApi, repoStatus, workingDir]);

  const loadChanges = useCallback(async (force = false) => {
    if (!(await ensureRepoReady({ force })) || !workingDir || !gitApi) return;
    setChangesLoading(true);
    setChangesError(null);
    const result = unwrapResult<GitFile[]>(
      await gitApi.getChangedFiles(workingDir)
    );
    if (result.ok) {
      setFiles(Array.isArray(result.data) ? result.data : []);
    } else {
      setFiles([]);
      setChangesError(formatError(result.error));
    }
    setChangesLoading(false);
  }, [ensureRepoReady, gitApi, workingDir]);

  const loadBranchDiff = useCallback(async (force = false) => {
    if (!(await ensureRepoReady({ force })) || !workingDir || !gitApi) return;
    if (!baseBranch) {
      setBranchDiffFiles([]);
      setBranchDiffError(null);
      return;
    }
    setBranchDiffLoading(true);
    setBranchDiffError(null);
    const result = unwrapResult<BranchDiffFile[]>(
      await gitApi.getBranchDiffFiles(workingDir, baseBranch, currentBranch || undefined)
    );
    if (result.ok) {
      setBranchDiffFiles(Array.isArray(result.data) ? result.data : []);
    } else {
      setBranchDiffFiles([]);
      setBranchDiffError(formatError(result.error));
    }
    setBranchDiffLoading(false);
  }, [baseBranch, currentBranch, ensureRepoReady, gitApi, workingDir]);

  const loadBranchDiffDetail = useCallback(async (force = false, filePath?: string | null) => {
    if (!(await ensureRepoReady({ force })) || !workingDir || !gitApi || !baseBranch) return;
    setBranchDiffDetailLoading(true);
    setBranchDiffDetailError(null);
    const targetPath = filePath?.trim() ? filePath.trim() : undefined;
    const result = unwrapResult<string>(
      await gitApi.getBranchDiff(workingDir, baseBranch, currentBranch || undefined, targetPath)
    );
    if (result.ok) {
      setBranchDiffText(result.data || '');
    } else {
      setBranchDiffText('');
      setBranchDiffDetailError(formatError(result.error));
    }
    setBranchDiffDetailLoading(false);
  }, [baseBranch, currentBranch, ensureRepoReady, gitApi, workingDir]);

  const loadDiff = useCallback(async (force = false, filePath?: string | null) => {
    if (!(await ensureRepoReady({ force })) || !workingDir || !gitApi) return;
    setDiffLoading(true);
    setDiffError(null);
    const targetPath = filePath?.trim() ? filePath.trim() : undefined;

    const [unstagedResultRaw, stagedResultRaw] = await Promise.all([
      gitApi.getDiff(workingDir, targetPath),
      gitApi.getStagedDiff(workingDir, targetPath),
    ]);

    const unstagedResult = unwrapResult<string>(unstagedResultRaw);
    const stagedResult = unwrapResult<string>(stagedResultRaw);

    if (unstagedResult.ok) {
      setDiffText(unstagedResult.data || '');
    } else {
      setDiffText('');
      setDiffError(formatError(unstagedResult.error));
    }

    if (stagedResult.ok) {
      setStagedDiffText(stagedResult.data || '');
    } else {
      setStagedDiffText('');
      setDiffError((prev) => prev || formatError(stagedResult.error));
    }

    setDiffLoading(false);
  }, [ensureRepoReady, gitApi, workingDir]);

  const handleStageToggle = useCallback(
    async (file: GitFile) => {
      if (!workingDir || !gitApi) return;
      setFileActions((prev) => ({ ...prev, [file.path]: true }));
      setChangesError(null);
      try {
        const action = file.staged ? gitApi.unstageFiles : gitApi.stageFiles;
        await action(workingDir, [file.path]);
      } catch (error) {
        setChangesError(formatError(error instanceof Error ? error.message : String(error)));
      }
      await loadChanges();
      await loadDiff(false, selectedFilePath);
      setFileActions((prev) => {
        const next = { ...prev };
        delete next[file.path];
        return next;
      });
    },
    [gitApi, loadChanges, loadDiff, selectedFilePath, workingDir]
  );

  const hasUnstagedFiles = useMemo(
    () => files.some((file) => hasUnstagedStatus(file.status)),
    [files]
  );
  const hasStagedFiles = useMemo(
    () => files.some((file) => file.staged),
    [files]
  );

  const handleStageAll = useCallback(async () => {
    if (!workingDir || !gitApi) return;
    const targets = files
      .filter((file) => hasUnstagedStatus(file.status))
      .map((file) => file.path);
    if (targets.length === 0) return;
    setBulkStageLoading(true);
    setChangesError(null);
    try {
      await gitApi.stageFiles(workingDir, targets);
    } catch (error) {
      setChangesError(formatError(error instanceof Error ? error.message : String(error)));
    }
    await loadChanges(true);
    await loadDiff(false, selectedFilePath);
    setBulkStageLoading(false);
  }, [files, gitApi, loadChanges, loadDiff, selectedFilePath, workingDir]);

  const handleCommit = useCallback(async () => {
    if (!workingDir || !gitApi) return;
    const message = commitMessage.trim();
    if (!message) {
      setActionMessage({ type: 'error', text: '提交信息不能为空。' });
      return;
    }
    setCommitLoading(true);
    setActionMessage(null);
    try {
      await gitApi.commit(workingDir, message);
      setCommitMessage('');
      setActionMessage({ type: 'success', text: '提交成功。' });
      await loadChanges(true);
      await loadDiff(true, selectedFilePath);
      await loadBranchDiff(true);
    } catch (error) {
      setActionMessage({
        type: 'error',
        text: formatError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setCommitLoading(false);
    }
  }, [commitMessage, gitApi, loadBranchDiff, loadChanges, loadDiff, selectedFilePath, workingDir]);

  const handleMerge = useCallback(async () => {
    if (!(await ensureRepoReady({ force: true })) || !workingDir || !gitApi || !baseBranch) return;
    if (!currentBranch || baseBranch === currentBranch) {
      setActionMessage({ type: 'info', text: '当前分支已是基准分支，无需合并。' });
      return;
    }
    setActionLoading('merge');
    setActionMessage(null);
    try {
      const worktreeResult = unwrapResult<WorktreeInfo[]>(
        await gitApi.listWorktrees(workingDir)
      );
      if (!worktreeResult.ok) {
        setActionMessage({
          type: 'error',
          text: formatError(worktreeResult.error) || '无法读取 worktree 列表。'
        });
        return;
      }
      const worktrees = Array.isArray(worktreeResult.data) ? worktreeResult.data : [];
      const targetRef = `refs/heads/${baseBranch}`;
      const targetWorktree = worktrees.find((worktree) => worktree.branch === targetRef);
      if (!targetWorktree?.path) {
        setActionMessage({
          type: 'error',
          text: `未找到基准分支 ${baseBranch} 的工作区，请先在某个工作区检出该分支。`
        });
        return;
      }

      const result = await gitApi.mergeBranch(targetWorktree.path, currentBranch) as {
        success?: boolean;
        conflicts?: string[];
      };
      if (result && result.success === false) {
        setActionMessage({
          type: 'error',
          text: formatConflictMessage(`合并到 ${baseBranch}`, result.conflicts)
        });
      } else {
        setActionMessage({
          type: 'success',
          text: `已将 ${currentBranch} 合并到 ${baseBranch}`
        });
      }
    } catch (error) {
      setActionMessage({
        type: 'error',
        text: formatError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setActionLoading(null);
      void loadChanges(true);
      void loadDiff(true, selectedFilePath);
      void loadBranchDiff(true);
    }
  }, [baseBranch, currentBranch, ensureRepoReady, gitApi, loadBranchDiff, loadChanges, loadDiff, selectedFilePath, workingDir]);

  const handleRebase = useCallback(async () => {
    if (!(await ensureRepoReady({ force: true })) || !workingDir || !gitApi || !baseBranch) return;
    if (!currentBranch || baseBranch === currentBranch) {
      setActionMessage({ type: 'info', text: '当前分支已是基准分支，无需变基。' });
      return;
    }
    setActionLoading('rebase');
    setActionMessage(null);
    try {
      const result = await gitApi.rebaseBranch(workingDir, baseBranch) as {
        success?: boolean;
        conflicts?: string[];
      };
      if (result && result.success === false) {
        setActionMessage({ type: 'error', text: formatConflictMessage('变基', result.conflicts) });
      } else {
        setActionMessage({ type: 'success', text: `已变基到 ${baseBranch}` });
      }
    } catch (error) {
      setActionMessage({
        type: 'error',
        text: formatError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setActionLoading(null);
      void loadChanges(true);
      void loadDiff(true, selectedFilePath);
      void loadBranchDiff(true);
    }
  }, [baseBranch, currentBranch, ensureRepoReady, gitApi, loadBranchDiff, loadChanges, loadDiff, selectedFilePath, workingDir]);

  const handleCreatePr = useCallback(async () => {
    if (!(await ensureRepoReady({ force: true })) || !workingDir || !gitApi) return;
    if (!baseBranch || !currentBranch || baseBranch === currentBranch) {
      setActionMessage({ type: 'info', text: '缺少基准分支或当前分支，无法创建 PR。' });
      return;
    }
    setActionLoading('pr');
    setActionMessage(null);
    try {
      const remoteUrl = await gitApi.getRemoteUrl(workingDir) as string;
      if (!remoteUrl || !remoteUrl.trim()) {
        throw new Error('无法获取远程仓库地址');
      }
      await gitApi.pushBranch(workingDir, currentBranch);

      const prUrl = buildPullRequestUrl(remoteUrl, baseBranch, currentBranch);
      if (prUrl) {
        await shell.openUrl(prUrl);
        setActionMessage({ type: 'success', text: '已打开 PR 创建页面。' });
      } else {
        const repoUrl = buildRepositoryUrl(remoteUrl);
        if (!repoUrl) {
          throw new Error('无法解析远程仓库地址');
        }
        await shell.openUrl(repoUrl);
        setActionMessage({ type: 'info', text: '已打开远程仓库，请手动创建 PR。' });
      }
    } catch (error) {
      setActionMessage({
        type: 'error',
        text: formatError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setActionLoading(null);
    }
  }, [baseBranch, currentBranch, ensureRepoReady, gitApi, workingDir]);

  const handleSelectFile = useCallback(
    (filePath: string | null) => {
      setSelectedFilePath(filePath);
      void loadDiff(true, filePath);
    },
    [loadDiff]
  );

  useEffect(() => {
    setRepoStatus('idle');
    setRepoError(null);
    setChangesError(null);
    setBranchDiffError(null);
    setDiffError(null);
    setFiles([]);
    setBranchDiffFiles([]);
    setBranchDiffSelectedPath(null);
    setBranchDiffText('');
    setDiffText('');
    setStagedDiffText('');
    setDiffLoading(false);
    setBranchDiffDetailLoading(false);
    setBranchDiffDetailError(null);
    setCurrentBranch(null);
    setSelectedFilePath(null);
    setBulkStageLoading(false);
    setCommitMessage('');
    setCommitLoading(false);
    setActionLoading(null);
    setActionMessage(null);
  }, [workingDir]);

  useEffect(() => {
    if (subTab === 'changes') {
      void loadChanges();
      void loadDiff(false, selectedFilePath);
    } else {
      void loadBranchDiff();
    }
  }, [loadBranchDiff, loadChanges, loadDiff, selectedFilePath, subTab]);

  useEffect(() => {
    if (!selectedFilePath) return;
    if (!files.some((file) => file.path === selectedFilePath)) {
      setSelectedFilePath(null);
      void loadDiff(true, null);
    }
  }, [files, loadDiff, selectedFilePath]);

  useEffect(() => {
    if (subTab !== 'compare') return;
    if (branchDiffFiles.length === 0) {
      setBranchDiffSelectedPath(null);
      setBranchDiffText('');
      setBranchDiffDetailError(null);
      return;
    }
    if (branchDiffSelectedPath && branchDiffFiles.some((file) => file.path === branchDiffSelectedPath)) {
      return;
    }
    const nextPath = branchDiffFiles[0]?.path || null;
    setBranchDiffSelectedPath(nextPath);
    if (nextPath) {
      void loadBranchDiffDetail(true, nextPath);
    }
  }, [branchDiffFiles, branchDiffSelectedPath, loadBranchDiffDetail, subTab]);

  const repoMessage = useMemo(() => {
    switch (repoStatus) {
      case 'no-working-dir':
        return { title: '没有工作目录', description: '该任务未绑定工作目录。' };
      case 'git-unavailable':
        return { title: 'Git 不可用', description: repoError || '请检查 Git 安装状态。' };
      case 'not-repo':
        return { title: '非 Git 仓库', description: repoError || '当前目录不是 Git 仓库。' };
      case 'checking':
        return { title: '正在检测 Git', description: '请稍候…' };
      case 'error':
        return { title: '无法加载 Git', description: repoError || '请稍后重试。' };
      default:
        return null;
    }
  }, [repoError, repoStatus]);

  const canRunBranchActions = Boolean(
    repoStatus === 'ready' && baseBranch && currentBranch && baseBranch !== currentBranch
  );
  const actionBusy = actionLoading !== null;
  const stageAllDisabled = !hasUnstagedFiles || bulkStageLoading || repoStatus !== 'ready';
  const commitDisabled = !hasStagedFiles || !commitMessage.trim() || commitLoading || repoStatus !== 'ready';

  return (
    <div className="flex h-full flex-col">
      {/* Sub Tab Bar */}
      <div className="flex gap-1 border-b px-4 py-2">
        <Button
          variant={subTab === 'changes' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSubTab('changes')}
        >
          变更
        </Button>
        <Button
          variant={subTab === 'compare' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSubTab('compare')}
        >
          对比
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {repoMessage ? (
          <GitEmptyState title={repoMessage.title} description={repoMessage.description} />
        ) : (
          <>
            {subTab === 'changes' ? (
              <GitChangesPanel
                files={files}
                loading={changesLoading}
                error={changesError}
                diffText={diffText}
                stagedDiffText={stagedDiffText}
                diffLoading={diffLoading}
                diffError={diffError}
                selectedFilePath={selectedFilePath}
                onRefresh={() => {
                  void loadChanges(true);
                  void loadDiff(true, selectedFilePath);
                }}
                onSelectFile={handleSelectFile}
                onToggleStage={handleStageToggle}
                busyMap={fileActions}
              />
            ) : (
              <GitBranchDiffPanel
                files={branchDiffFiles}
                baseBranch={baseBranch}
                currentBranch={currentBranch}
                loading={branchDiffLoading}
                error={branchDiffError}
                diffText={branchDiffText}
                diffLoading={branchDiffDetailLoading}
                diffError={branchDiffDetailError}
                selectedFilePath={branchDiffSelectedPath}
                onSelectFile={(filePath) => {
                  setBranchDiffSelectedPath(filePath);
                  void loadBranchDiffDetail(true, filePath);
                }}
                onRefresh={() => {
                  void loadBranchDiff(true);
                  if (branchDiffSelectedPath) {
                    void loadBranchDiffDetail(true, branchDiffSelectedPath);
                  }
                }}
                className="h-full overflow-auto"
              />
            )}
          </>
        )}
      </div>

      {/* Git Actions */}
      <div className="border-t p-4 space-y-2">
        {actionMessage && (
          <div
            className={cn(
              'text-xs',
              actionMessage.type === 'error'
                ? 'text-destructive'
                : actionMessage.type === 'success'
                  ? 'text-emerald-600'
                  : 'text-muted-foreground'
            )}
          >
            {actionMessage.text}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleStageAll()}
            disabled={stageAllDisabled}
          >
            {bulkStageLoading ? '暂存中...' : '全部暂存'}
          </Button>
          <input
            type="text"
            value={commitMessage}
            placeholder={hasStagedFiles ? '输入提交信息' : '暂无已暂存变更'}
            onChange={(event) => setCommitMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !commitDisabled) {
                event.preventDefault();
                void handleCommit();
              }
            }}
            disabled={!hasStagedFiles || commitLoading || repoStatus !== 'ready'}
            className="border-input bg-background text-foreground focus:ring-ring block h-9 flex-1 rounded-md border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none disabled:opacity-60"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCommit()}
            disabled={commitDisabled}
          >
            {commitLoading ? '提交中...' : '提交'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => void handleMerge()}
            disabled={!canRunBranchActions || actionBusy}
          >
            {actionLoading === 'merge' ? '合并中...' : '合并'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => void handleCreatePr()}
            disabled={!canRunBranchActions || actionBusy}
          >
            {actionLoading === 'pr' ? '创建中...' : '创建PR'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => void handleRebase()}
            disabled={!canRunBranchActions || actionBusy}
          >
            {actionLoading === 'rebase' ? '变基中...' : '变基'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Git Changes Panel Component
interface GitChangesPanelProps {
  files: GitFile[];
  loading: boolean;
  error: string | null;
  diffText: string;
  stagedDiffText: string;
  diffLoading: boolean;
  diffError: string | null;
  selectedFilePath: string | null;
  onRefresh: () => void;
  onSelectFile: (filePath: string | null) => void;
  onToggleStage: (file: GitFile) => void;
  busyMap: Record<string, boolean>;
}

function GitChangesPanel({
  files,
  loading,
  error,
  diffText,
  stagedDiffText,
  diffLoading,
  diffError,
  selectedFilePath,
  onRefresh,
  onSelectFile,
  onToggleStage,
  busyMap,
}: GitChangesPanelProps) {
  const statusColors: Record<string, string> = {
    M: 'text-amber-500',
    A: 'text-green-500',
    D: 'text-red-500',
    R: 'text-blue-500',
    '?': 'text-muted-foreground',
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="flex w-72 flex-col gap-3 overflow-hidden rounded-lg border bg-muted/10 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">文件列表</div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading || diffLoading}>
            {loading || diffLoading ? '加载中...' : '刷新'}
          </Button>
        </div>

        {error && (
          <div className="text-destructive text-sm">{error}</div>
        )}

        <div className="flex-1 overflow-auto">
          {files.length === 0 ? (
            <GitEmptyState title="暂无变更" />
          ) : (
            <div className="space-y-1">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectFile(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectFile(null);
                  }
                }}
                className={cn(
                  'hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm',
                  !selectedFilePath && 'bg-muted/60'
                )}
              >
                <span className="text-muted-foreground font-mono">*</span>
                <span className="flex-1 truncate">全部变更</span>
              </div>
              {files.map((file) => (
                <div
                  key={file.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectFile(file.path)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectFile(file.path);
                    }
                  }}
                  className={cn(
                    'hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm',
                    selectedFilePath === file.path && 'bg-muted/60'
                  )}
                >
                  <span
                    className={cn(
                      'font-mono',
                      statusColors[getStatusCode(file.status)]
                    )}
                  >
                    {getStatusCode(file.status)}
                  </span>
                  <span className="flex-1 truncate">{file.path}</span>
                  {file.staged && (
                    <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
                      已暂存
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleStage(file);
                    }}
                    disabled={loading || busyMap[file.path]}
                  >
                    {file.staged ? '取消暂存' : '暂存'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-background p-3">
        <GitDiffView
          diffText={diffText}
          stagedDiffText={stagedDiffText}
          loading={diffLoading}
          error={diffError}
          className="h-full"
        />
      </div>
    </div>
  );
}

function GitBranchDiffPanel({
  files,
  baseBranch,
  currentBranch,
  loading,
  error,
  diffText,
  diffLoading,
  diffError,
  selectedFilePath,
  onSelectFile,
  onRefresh,
  className,
}: {
  files: BranchDiffFile[];
  baseBranch?: string | null;
  currentBranch: string | null;
  loading: boolean;
  error: string | null;
  diffText: string;
  diffLoading: boolean;
  diffError: string | null;
  selectedFilePath: string | null;
  onSelectFile: (filePath: string | null) => void;
  onRefresh: () => void;
  className?: string;
}) {
  const statusColors: Record<string, string> = {
    M: 'text-amber-500',
    A: 'text-green-500',
    D: 'text-red-500',
    R: 'text-blue-500',
    '?': 'text-muted-foreground',
  };

  const compareLabel = baseBranch
    ? `${baseBranch} → ${currentBranch || '当前'}`
    : null;

  return (
    <div className={cn('flex h-full min-h-0 gap-4', className)}>
      <div className="flex w-72 flex-col gap-3 overflow-hidden rounded-lg border bg-muted/10 p-3">
        <div className="flex items-center justify-between gap-3">
          {compareLabel ? (
            <div className="text-muted-foreground truncate text-xs">{compareLabel}</div>
          ) : (
            <span />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading || !baseBranch}
          >
            {loading ? '加载中...' : '刷新'}
          </Button>
        </div>

        {error && (
          <div className="text-destructive text-sm">{error}</div>
        )}

        <div className="flex-1 overflow-auto">
          {!baseBranch ? (
            <GitEmptyState title="缺少基准分支" />
          ) : files.length === 0 ? (
            <GitEmptyState title="无差异" />
          ) : (
            <div className="space-y-1">
              {files.map((file) => (
                <div
                  key={`${file.status}-${file.path}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectFile(file.path)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectFile(file.path);
                    }
                  }}
                  className={cn(
                    'hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm',
                    selectedFilePath === file.path && 'bg-muted/60'
                  )}
                >
                  <span
                    className={cn(
                      'font-mono',
                      statusColors[getStatusCode(file.status)]
                    )}
                  >
                    {getStatusCode(file.status)}
                  </span>
                  <span className="flex-1 truncate">{file.path}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-background p-3">
        {!selectedFilePath ? (
          <GitEmptyState title="请选择文件查看差异" />
        ) : (
          <GitDiffView
            diffText={diffText}
            loading={diffLoading}
            error={diffError}
            groupLabels={{ unstaged: '分支差异' }}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

function GitEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
      <div className="text-foreground text-sm font-medium">{title}</div>
      {description && <div className="max-w-[240px] text-xs">{description}</div>}
    </div>
  );
}
