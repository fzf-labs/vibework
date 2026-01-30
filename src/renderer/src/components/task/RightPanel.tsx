import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Play, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/providers/language-provider';
import type { Artifact } from '@/components/artifacts';
import { FileListPanel } from './FileListPanel';

export type RightPanelTab = 'files' | 'server' | 'git';

interface RightPanelProps {
  workingDir: string;
  artifacts: Artifact[];
  selectedArtifact: Artifact | null;
  onSelectArtifact: (artifact: Artifact) => void;
  // Live preview props
  livePreviewUrl: string | null;
  livePreviewStatus: string;
  livePreviewError: string | null;
  onStartLivePreview?: () => void;
  onStopLivePreview: () => void;
  // File preview component
  renderFilePreview: () => React.ReactNode;
}

export function RightPanel({
  workingDir,
  artifacts,
  selectedArtifact,
  onSelectArtifact,
  livePreviewUrl,
  livePreviewStatus,
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  renderFilePreview,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('files');
  const { t } = useLanguage();

  const tabs: { id: RightPanelTab; label: string; icon: typeof FileText }[] = [
    { id: 'files', label: t.preview.filesTab, icon: FileText },
    { id: 'server', label: t.preview.serverTab, icon: Play },
    { id: 'git', label: t.preview.gitTab, icon: GitBranch },
  ];

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
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
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
              artifacts={artifacts}
              workingDir={workingDir}
              selectedArtifact={selectedArtifact}
              onSelectArtifact={onSelectArtifact}
            />
            <div className="min-w-0 flex-1">{renderFilePreview()}</div>
          </div>
        )}

        {activeTab === 'server' && (
          <DevServerPanel
            workingDir={workingDir}
            previewUrl={livePreviewUrl}
            status={livePreviewStatus}
            error={livePreviewError}
            onStart={onStartLivePreview}
            onStop={onStopLivePreview}
          />
        )}

        {activeTab === 'git' && (
          <GitPanel workingDir={workingDir} />
        )}
      </div>
    </div>
  );
}

// Dev Server Panel Component
interface DevServerPanelProps {
  workingDir: string;
  previewUrl: string | null;
  status: string;
  error: string | null;
  onStart?: () => void;
  onStop: () => void;
}

function DevServerPanel({
  workingDir,
  previewUrl,
  status,
  error,
  onStart,
  onStop,
}: DevServerPanelProps) {
  const isRunning = status === 'running';
  const isStarting = status === 'starting';

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-sm">
          <span className="text-muted-foreground">状态: </span>
          <span className={cn(
            isRunning && 'text-green-500',
            isStarting && 'text-amber-500',
            error && 'text-red-500'
          )}>
            {isRunning ? '运行中' : isStarting ? '启动中...' : error ? '错误' : '已停止'}
          </span>
        </div>
        <div className="flex gap-2">
          {!isRunning && !isStarting && onStart && (
            <Button size="sm" onClick={onStart} disabled={!workingDir}>
              <Play className="mr-1 h-4 w-4" />
              启动
            </Button>
          )}
          {(isRunning || isStarting) && (
            <Button size="sm" variant="outline" onClick={onStop}>
              停止
            </Button>
          )}
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-red-500">{error}</div>
        )}
        {previewUrl && isRunning && (
          <iframe
            src={previewUrl}
            className="h-full w-full border-0"
            title="Dev Server Preview"
          />
        )}
        {!previewUrl && !error && !isStarting && (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            点击"启动"按钮启动开发服务器
          </div>
        )}
      </div>
    </div>
  );
}

// Git Panel Component
interface GitPanelProps {
  workingDir: string;
}

type GitSubTab = 'changes' | 'history' | 'branches';

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
}

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
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
  if (!result) {
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

function GitPanel({ workingDir }: GitPanelProps) {
  const [subTab, setSubTab] = useState<GitSubTab>('changes');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepoStatus>('idle');
  const [repoError, setRepoError] = useState<string | null>(null);
  const [changesLoading, setChangesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [fileActions, setFileActions] = useState<Record<string, boolean>>({});
  const [checkoutBranch, setCheckoutBranch] = useState<string | null>(null);

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

  const loadHistory = useCallback(async (force = false) => {
    if (!(await ensureRepoReady({ force })) || !workingDir || !gitApi) return;
    setHistoryLoading(true);
    setHistoryError(null);
    const result = unwrapResult<GitCommit[]>(
      await gitApi.getCommitLog(workingDir, 20)
    );
    if (result.ok) {
      setCommits(Array.isArray(result.data) ? result.data : []);
    } else {
      setCommits([]);
      setHistoryError(formatError(result.error));
    }
    setHistoryLoading(false);
  }, [ensureRepoReady, gitApi, workingDir]);

  const loadBranches = useCallback(async (force = false) => {
    if (!(await ensureRepoReady({ force })) || !workingDir || !gitApi) return;
    setBranchesLoading(true);
    setBranchesError(null);
    const [branchesResult, currentResult] = await Promise.all([
      gitApi.getBranches(workingDir),
      gitApi.getCurrentBranch(workingDir)
    ]);
    const parsedBranches = unwrapResult<string[]>(branchesResult);
    const parsedCurrent = unwrapResult<string>(currentResult);
    if (!parsedBranches.ok || !parsedCurrent.ok) {
      setBranches([]);
      setBranchesError(
        formatError(parsedBranches.error || parsedCurrent.error || undefined)
      );
    } else {
      setBranches(Array.isArray(parsedBranches.data) ? parsedBranches.data : []);
      setCurrentBranch(parsedCurrent.data || null);
    }
    setBranchesLoading(false);
  }, [ensureRepoReady, gitApi, workingDir]);

  const handleStageToggle = useCallback(
    async (file: GitFile) => {
      if (!workingDir || !gitApi) return;
      setFileActions((prev) => ({ ...prev, [file.path]: true }));
      setChangesError(null);
      const action = file.staged ? gitApi.unstageFiles : gitApi.stageFiles;
      const result = unwrapResult(await action(workingDir, [file.path]));
      if (!result.ok) {
        setChangesError(formatError(result.error));
      }
      await loadChanges();
      setFileActions((prev) => {
        const next = { ...prev };
        delete next[file.path];
        return next;
      });
    },
    [gitApi, loadChanges, workingDir]
  );

  const handleCheckout = useCallback(
    async (branchName: string) => {
      if (!workingDir || !gitApi || branchName === currentBranch) return;
      setCheckoutBranch(branchName);
      setBranchesError(null);
      const result = unwrapResult(await gitApi.checkoutBranch(workingDir, branchName));
      if (!result.ok) {
        setBranchesError(formatError(result.error));
      }
      await Promise.all([loadBranches(), loadChanges(), loadHistory()]);
      setCheckoutBranch(null);
    },
    [currentBranch, gitApi, loadBranches, loadChanges, loadHistory, workingDir]
  );

  useEffect(() => {
    setRepoStatus('idle');
    setRepoError(null);
    setChangesError(null);
    setHistoryError(null);
    setBranchesError(null);
    setFiles([]);
    setCommits([]);
    setBranches([]);
    setCurrentBranch(null);
  }, [workingDir]);

  useEffect(() => {
    if (subTab === 'changes') {
      void loadChanges();
    } else if (subTab === 'history') {
      void loadHistory();
    } else {
      void loadBranches();
    }
  }, [loadBranches, loadChanges, loadHistory, subTab]);

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

  const actionsDisabled = repoStatus !== 'ready';

  return (
    <div className="flex h-full flex-col">
      {/* Sub Tab Bar */}
      <div className="flex gap-1 border-b px-4 py-2">
        <Button
          variant={subTab === 'changes' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSubTab('changes')}
        >
          变更文件
        </Button>
        <Button
          variant={subTab === 'history' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSubTab('history')}
        >
          提交历史
        </Button>
        <Button
          variant={subTab === 'branches' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSubTab('branches')}
        >
          分支
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {repoMessage ? (
          <GitEmptyState title={repoMessage.title} description={repoMessage.description} />
        ) : (
          <>
            {subTab === 'changes' && (
              <GitChangesPanel
                files={files}
                loading={changesLoading}
                error={changesError}
                onRefresh={() => loadChanges(true)}
                onToggleStage={handleStageToggle}
                busyMap={fileActions}
              />
            )}
            {subTab === 'history' && (
              <GitHistoryPanel
                commits={commits}
                loading={historyLoading}
                error={historyError}
                onRefresh={() => loadHistory(true)}
              />
            )}
            {subTab === 'branches' && (
              <GitBranchesPanel
                branches={branches}
                currentBranch={currentBranch}
                loading={branchesLoading}
                error={branchesError}
                onRefresh={() => loadBranches(true)}
                onCheckout={handleCheckout}
                checkoutBranch={checkoutBranch}
              />
            )}
          </>
        )}
      </div>

      {/* Git Actions */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" disabled>
            合并
          </Button>
          <Button variant="outline" size="sm" className="flex-1" disabled>
            创建PR
          </Button>
          <Button variant="outline" size="sm" className="flex-1" disabled>
            变基
          </Button>
        </div>
        {actionsDisabled && (
          <div className="text-muted-foreground mt-2 text-xs">
            Git 功能准备就绪后将开放更多操作
          </div>
        )}
      </div>
    </div>
  );
}

// Git Changes Panel Component
interface GitChangesPanelProps {
  files: GitFile[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onToggleStage: (file: GitFile) => void;
  busyMap: Record<string, boolean>;
}

function GitChangesPanel({
  files,
  loading,
  error,
  onRefresh,
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">变更文件</span>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      {error && (
        <div className="text-destructive text-sm">{error}</div>
      )}

      {files.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          暂无变更文件
        </div>
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.path}
              className="hover:bg-muted/50 flex items-center gap-2 rounded px-2 py-1 text-sm"
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
                onClick={() => onToggleStage(file)}
                disabled={loading || busyMap[file.path]}
              >
                {file.staged ? '取消暂存' : '暂存'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GitHistoryPanel({
  commits,
  loading,
  error,
  onRefresh,
}: {
  commits: GitCommit[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">提交历史</span>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      {error && (
        <div className="text-destructive text-sm">{error}</div>
      )}

      {commits.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          暂无提交记录
        </div>
      ) : (
        <div className="space-y-2">
          {commits.map((commit) => (
            <div key={commit.hash} className="border-border/60 rounded border p-2">
              <div className="text-sm font-medium">{commit.message}</div>
              <div className="text-muted-foreground mt-1 text-xs">
                {commit.author} · {commit.date} · {commit.hash.slice(0, 7)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GitBranchesPanel({
  branches,
  currentBranch,
  loading,
  error,
  onRefresh,
  onCheckout,
  checkoutBranch,
}: {
  branches: string[];
  currentBranch: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCheckout: (branchName: string) => void;
  checkoutBranch: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">分支</span>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      {error && (
        <div className="text-destructive text-sm">{error}</div>
      )}

      {branches.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          暂无分支
        </div>
      ) : (
        <div className="space-y-1">
          {branches.map((branch) => {
            const isCurrent = branch === currentBranch;
            return (
              <div
                key={branch}
                className={cn(
                  'hover:bg-muted/50 flex items-center gap-2 rounded px-2 py-1 text-sm',
                  isCurrent && 'bg-muted/40'
                )}
              >
                <span className="flex-1 truncate">
                  {branch}
                  {isCurrent && (
                    <span className="text-muted-foreground ml-2 text-xs">当前</span>
                  )}
                </span>
                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCheckout(branch)}
                    disabled={loading || checkoutBranch === branch}
                  >
                    {checkoutBranch === branch ? '切换中...' : '切换'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GitEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
      <div className="text-foreground text-sm font-medium">{title}</div>
      <div className="max-w-[240px] text-xs">{description}</div>
    </div>
  );
}
