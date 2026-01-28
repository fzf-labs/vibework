import { useState } from 'react';
import { FileText, Play, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Artifact } from '@/components/artifacts';

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

const tabs: { id: RightPanelTab; label: string; icon: typeof FileText }[] = [
  { id: 'files', label: '文件预览', icon: FileText },
  { id: 'server', label: '开发服务器', icon: Play },
  { id: 'git', label: 'Git', icon: GitBranch },
];

export function RightPanel({
  workingDir,
  artifacts,
  livePreviewUrl,
  livePreviewStatus,
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  renderFilePreview,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>('files');

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
          <div className="h-full">{renderFilePreview()}</div>
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
  status: 'M' | 'A' | 'D' | 'R' | '?';
}

function GitPanel({ workingDir }: GitPanelProps) {
  const [subTab, setSubTab] = useState<GitSubTab>('changes');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [loading, setLoading] = useState(false);

  // Load git status
  const loadGitStatus = async () => {
    if (!workingDir) return;
    setLoading(true);
    try {
      // TODO: Call git API when available
      setFiles([]);
    } catch (error) {
      console.error('Failed to load git status:', error);
    } finally {
      setLoading(false);
    }
  };

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
        {subTab === 'changes' && (
          <GitChangesPanel files={files} loading={loading} onRefresh={loadGitStatus} />
        )}
        {subTab === 'history' && (
          <div className="text-muted-foreground text-center text-sm">
            提交历史功能开发中...
          </div>
        )}
        {subTab === 'branches' && (
          <div className="text-muted-foreground text-center text-sm">
            分支管理功能开发中...
          </div>
        )}
      </div>

      {/* Git Actions */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            合并
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            创建PR
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
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
  onRefresh: () => void;
}

function GitChangesPanel({ files, loading, onRefresh }: GitChangesPanelProps) {
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
              <span className={cn('font-mono', statusColors[file.status])}>
                {file.status}
              </span>
              <span className="truncate">{file.path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
