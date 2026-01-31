import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Play, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/providers/language-provider';
import type { Artifact } from '@/components/artifacts';
import { GitDiffView } from '@/components/git';
import { FileListPanel } from './FileListPanel';

export type RightPanelTab = 'files' | 'server' | 'git';

interface RightPanelProps {
  workingDir: string;
  branchName?: string | null;
  baseBranch?: string | null;
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
  branchName,
  baseBranch,
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
    { id: 'git', label: t.preview.gitTab, icon: GitBranch },
    { id: 'server', label: t.preview.serverTab, icon: Play },
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
              workingDir={workingDir}
              branchName={branchName}
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
          <GitPanel workingDir={workingDir} baseBranch={baseBranch} />
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
  baseBranch?: string | null;
}

type GitSubTab = 'changes' | 'compare';

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
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

function GitPanel({ workingDir, baseBranch }: GitPanelProps) {
  const [subTab, setSubTab] = useState<GitSubTab>('changes');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepoStatus>('idle');
  const [repoError, setRepoError] = useState<string | null>(null);
  const [changesLoading, setChangesLoading] = useState(false);
  const [branchDiffLoading, setBranchDiffLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [branchDiffError, setBranchDiffError] = useState<string | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [fileActions, setFileActions] = useState<Record<string, boolean>>({});
  const [branchDiffFiles, setBranchDiffFiles] = useState<BranchDiffFile[]>([]);
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
      const action = file.staged ? gitApi.unstageFiles : gitApi.stageFiles;
      const result = unwrapResult(await action(workingDir, [file.path]));
      if (!result.ok) {
        setChangesError(formatError(result.error));
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
    setDiffText('');
    setStagedDiffText('');
    setDiffLoading(false);
    setCurrentBranch(null);
    setSelectedFilePath(null);
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
                onRefresh={() => loadBranchDiff(true)}
                className="h-full overflow-auto"
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
  onRefresh,
  className,
}: {
  files: BranchDiffFile[];
  baseBranch?: string | null;
  currentBranch: string | null;
  loading: boolean;
  error: string | null;
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
    <div className={cn('space-y-3', className)}>
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

      {!baseBranch ? (
        <GitEmptyState title="缺少基准分支" />
      ) : files.length === 0 ? (
        <GitEmptyState title="无差异" />
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={`${file.status}-${file.path}`}
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
            </div>
          ))}
        </div>
      )}
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
