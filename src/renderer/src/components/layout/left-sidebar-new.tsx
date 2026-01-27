import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ImageLogo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import {
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  LayoutGrid,
  PanelLeft,
  Plus,
  Server,
  Settings,
  Sparkles,
  Trash2,
  FolderOpen,
  Info,
} from 'lucide-react';

import { SettingsModal } from '@/components/settings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useSidebar } from './sidebar-context';
import { useProjects, type Project } from '@/hooks/useProjects';

// Navigation items configuration
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'board', label: '看板', icon: LayoutGrid, path: '/board' },
  { id: 'skills', label: 'Skill', icon: Sparkles, path: '/skills' },
  { id: 'mcp', label: 'MCP', icon: Server, path: '/mcp' },
];

export function LeftSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { leftOpen, toggleLeft } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);

  const {
    projects,
    currentProject,
    setCurrentProjectId,
    addProject,
    deleteProject,
    updateProject,
  } = useProjects();

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleNewProject = () => {
    setCreateDialogOpen(true);
  };

  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？')) {
      await deleteProject(id);
    }
  };

  const handleOpenInFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.api.shell.showItemInFolder(path);
  };

  const handleShowDetail = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailProject(project);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'border-sidebar-border bg-sidebar flex h-full shrink-0 flex-col border-none transition-all duration-300',
          leftOpen ? 'w-56' : 'w-14'
        )}
      >
        {/* Header: Logo & Toggle */}
        <Header leftOpen={leftOpen} toggleLeft={toggleLeft} />

        {/* Navigation */}
        <Navigation
          items={navItems}
          currentPath={location.pathname}
          collapsed={!leftOpen}
          onNavigate={handleNavClick}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Project Switcher */}
        <ProjectSwitcher
          currentProject={currentProject}
          projects={projects}
          collapsed={!leftOpen}
          onSelectProject={handleSelectProject}
          onNewProject={handleNewProject}
          onDeleteProject={handleDeleteProject}
          onOpenInFolder={handleOpenInFolder}
          onShowDetail={handleShowDetail}
        />

        {/* Settings Button */}
        <SettingsButton
          collapsed={!leftOpen}
          onClick={() => setSettingsOpen(true)}
        />
      </aside>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAddProject={addProject}
        onSetCurrentProject={setCurrentProjectId}
      />
      <ProjectDetailDialog
        project={detailProject}
        onOpenChange={(open) => !open && setDetailProject(null)}
        onUpdate={updateProject}
      />
    </TooltipProvider>
  );
}

// Header Component
function Header({
  leftOpen,
  toggleLeft,
}: {
  leftOpen: boolean;
  toggleLeft: () => void;
}) {
  if (leftOpen) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <img src={ImageLogo} alt="VibeWork" className="size-9" />
          <span className="text-sidebar-foreground font-mono text-lg font-medium">
            VibeWork
          </span>
        </div>
        <button
          onClick={toggleLeft}
          className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-center p-3">
      <button
        onClick={toggleLeft}
        className="hover:bg-sidebar-accent flex size-9 cursor-pointer items-center justify-center rounded-xl transition-all"
      >
        <img src={ImageLogo} alt="VibeWork" className="size-9" />
      </button>
    </div>
  );
}

// Navigation Component
function Navigation({
  items,
  currentPath,
  collapsed,
  onNavigate,
}: {
  items: typeof navItems;
  currentPath: string;
  collapsed: boolean;
  onNavigate: (path: string) => void;
}) {
  return (
    <nav className={cn('flex flex-col gap-1', collapsed ? 'px-2' : 'px-3')}>
      {items.map((item) => {
        const isActive = currentPath === item.path;
        const Icon = item.icon;

        if (collapsed) {
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onNavigate(item.path)}
                  className={cn(
                    'flex size-10 cursor-pointer items-center justify-center rounded-xl transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Project Switcher Component
function ProjectSwitcher({
  currentProject,
  projects,
  collapsed,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  onOpenInFolder,
  onShowDetail,
}: {
  currentProject: Project | null;
  projects: Project[];
  collapsed: boolean;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onOpenInFolder: (path: string, e: React.MouseEvent) => void;
  onShowDetail: (project: Project, e: React.MouseEvent) => void;
}) {
  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="bg-sidebar-accent hover:ring-sidebar-foreground/20 flex size-10 cursor-pointer items-center justify-center rounded-xl transition-all hover:ring-2">
                  <FolderKanban className="text-sidebar-foreground/70 size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={8}>
                {projects.length === 0 ? (
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    暂无项目
                  </DropdownMenuItem>
                ) : (
                  projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      className={cn(
                        'cursor-pointer flex items-center justify-between gap-2',
                        currentProject?.id === p.id && 'bg-accent'
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => onShowDetail(p, e)}
                          className="p-1 hover:bg-accent rounded"
                        >
                          <Info className="size-3" />
                        </button>
                        <button
                          onClick={(e) => onOpenInFolder(p.path, e)}
                          className="p-1 hover:bg-accent rounded"
                        >
                          <FolderOpen className="size-3" />
                        </button>
                        <button
                          onClick={(e) => onDeleteProject(p.id, e)}
                          className="p-1 hover:bg-destructive/20 rounded text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onNewProject} className="cursor-pointer">
                  <Plus className="size-4" />
                  <span>新建项目</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          <TooltipContent side="right">切换项目</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="hover:bg-sidebar-accent flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors">
            <FolderKanban className="text-sidebar-foreground/70 size-5" />
            <span className="text-sidebar-foreground flex-1 truncate text-left text-sm">
              {currentProject?.name || '选择项目'}
            </span>
            <ChevronsUpDown className="text-sidebar-foreground/40 size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" side="top" align="start">
          {projects.length === 0 ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              暂无项目
            </DropdownMenuItem>
          ) : (
            projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={cn(
                  'cursor-pointer flex items-center justify-between gap-2',
                  currentProject?.id === p.id && 'bg-accent'
                )}
              >
                <span className="truncate flex-1">{p.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => onOpenInFolder(p.path, e)}
                    className="p-1 hover:bg-accent rounded"
                  >
                    <FolderOpen className="size-3" />
                  </button>
                  <button
                    onClick={(e) => onDeleteProject(p.id, e)}
                    className="p-1 hover:bg-destructive/20 rounded text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onNewProject} className="cursor-pointer">
            <Plus className="size-4" />
            <span>新建项目</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Settings Button Component
function SettingsButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  if (collapsed) {
    return (
      <div className="flex justify-center px-2 pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClick}
              className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-10 cursor-pointer items-center justify-center rounded-xl transition-colors"
            >
              <Settings className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">设置</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4">
      <button
        onClick={onClick}
        className="text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
      >
        <Settings className="size-5" />
        <span>设置</span>
      </button>
    </div>
  );
}

// Create Project Dialog Component
function CreateProjectDialog({
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

// Project Detail Dialog Component
function ProjectDetailDialog({
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
  const [isEditing, setIsEditing] = useState(false);

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setIsEditing(false);
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
          <DialogTitle>项目详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">项目名称</label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{project.name}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">项目路径</label>
            <p className="text-sm text-muted-foreground break-all">{project.path}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">描述</label>
            {isEditing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="添加项目描述..."
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px]"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {project.description || '暂无描述'}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">创建时间</label>
            <p className="text-sm text-muted-foreground">
              {new Date(project.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 rounded-lg text-sm hover:bg-muted"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
                >
                  编辑
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
