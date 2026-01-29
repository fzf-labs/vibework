import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Project } from '@/hooks/useProjects';

export function CreateProjectDialog({
  open,
  onOpenChange,
  onAddProject,
  onSetCurrentProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddProject: (input: {
    name: string;
    path: string;
    type: 'local' | 'remote';
    remoteUrl?: string;
  }) => Promise<Project>;
  onSetCurrentProject: (id: string) => void;
}) {
  const [mode, setMode] = useState<'local' | 'clone'>('local');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setMode('local');
    setName('');
    setPath('');
    setRemoteUrl('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSelectFolder = async () => {
    const result = await window.api.dialog.open({
      properties: ['openDirectory', 'createDirectory'],
      title: mode === 'clone' ? '选择克隆目标目录' : '选择项目目录',
    });
    if (result) {
      setPath(result as string);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let projectPath = path;

      if (mode === 'clone') {
        if (!remoteUrl) {
          throw new Error('请输入仓库地址');
        }
        if (!path) {
          throw new Error('请选择目标目录');
        }

        // Clone the repository
        const clonePath = `${path}/${name || remoteUrl.split('/').pop()?.replace('.git', '')}`;
        const result = await window.api.git.clone(remoteUrl, clonePath) as { success: boolean; error?: string };
        if (!result.success) {
          throw new Error(result.error || '克隆失败');
        }
        projectPath = clonePath;
      } else {
        if (!path) {
          throw new Error('请选择项目目录');
        }
      }

      const project = await onAddProject({
        name: name || projectPath.split('/').pop() || 'Untitled',
        path: projectPath,
        type: mode === 'clone' ? 'remote' : 'local',
        remoteUrl: mode === 'clone' ? remoteUrl : undefined,
      });

      onSetCurrentProject(project.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建项目失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('local')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm transition-colors',
              mode === 'local'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            本地项目
          </button>
          <button
            type="button"
            onClick={() => setMode('clone')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm transition-colors',
              mode === 'clone'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            克隆仓库
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'clone' && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                仓库地址
              </label>
              <input
                type="text"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              项目名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入项目名称（可选）"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {mode === 'clone' ? '目标目录' : '项目目录'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="选择目录路径"
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm"
                readOnly
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm"
              >
                浏览
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm hover:bg-muted"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectEditDialog({
  project,
  onOpenChange,
  onUpdate,
}: {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Project>) => Promise<Project | null>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
    }
  }, [project]);

  const handleSave = async () => {
    if (!project) return;
    setLoading(true);
    try {
      await onUpdate(project.id, { name, description });
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={!!project} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑项目</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">项目路径</label>
            <p className="text-sm text-muted-foreground break-all">{project.path}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加项目描述..."
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">创建时间</label>
            <p className="text-sm text-muted-foreground">
              {new Date(project.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-sm hover:bg-muted"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
