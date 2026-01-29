import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ImageLogo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import {
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  PanelLeft,
  Server,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { SettingsModal } from '@/components/settings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useSidebar } from './sidebar-context';
import { useProjects, type Project } from '@/hooks/useProjects';
import { useLanguage } from '@/providers/language-provider';

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
};

export function LeftSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { leftOpen, toggleLeft } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useLanguage();

  const {
    projects,
    currentProject,
    setCurrentProjectId,
    checkProjectPath,
    refresh,
  } = useProjects();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard, path: '/dashboard' },
    { id: 'board', label: t.nav.board, icon: KanbanSquare, path: '/board' },
    {
      id: 'pipelineTemplates',
      label: t.nav.pipelineTemplates,
      icon: ListChecks,
      path: '/pipeline-templates',
    },
    { id: 'skills', label: t.nav.skills, icon: Sparkles, path: '/skills' },
    { id: 'mcp', label: t.nav.mcp, icon: Server, path: '/mcp' },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleSelectProject = async (id: string) => {
    try {
      const result = await checkProjectPath(id);
      if (!result.exists) {
        alert('项目路径不存在或已移动，请检查项目路径。');
        return;
      }
      if (result.updated) {
        await refresh();
      }
      setCurrentProjectId(id);
    } catch (error) {
      console.error('Failed to check project path:', error);
      alert('无法验证项目路径，请稍后重试。');
    }
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
          onManageProjects={() => navigate('/projects')}
        />

        {/* Settings Button */}
        <SettingsButton
          collapsed={!leftOpen}
          onClick={() => setSettingsOpen(true)}
        />
      </aside>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
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
  items: NavItem[];
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
  onManageProjects,
}: {
  currentProject: Project | null;
  projects: Project[];
  collapsed: boolean;
  onSelectProject: (id: string) => void | Promise<void>;
  onManageProjects: () => void;
}) {
  if (collapsed) {
    return (
      <div className="px-2 pb-2 flex flex-col items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="bg-sidebar-accent hover:ring-sidebar-foreground/20 flex size-10 cursor-pointer items-center justify-center rounded-xl transition-all hover:ring-2">
                  <FolderKanban className="text-sidebar-foreground/70 size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={8}>
                <DropdownMenuItem onClick={onManageProjects} className="cursor-pointer">
                  <Settings className="size-4" />
                  <span>项目管理</span>
                </DropdownMenuItem>
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
                        'cursor-pointer',
                        currentProject?.id === p.id && 'bg-accent'
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
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
        <DropdownMenuContent className="w-56 -ml-3" side="top" align="start">
          <DropdownMenuItem onClick={onManageProjects} className="cursor-pointer">
            <Settings className="size-4" />
            <span>项目管理</span>
          </DropdownMenuItem>
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
                  'cursor-pointer',
                  currentProject?.id === p.id && 'bg-accent'
                )}
              >
                <span className="truncate flex-1">{p.name}</span>
              </DropdownMenuItem>
            ))
          )}
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
