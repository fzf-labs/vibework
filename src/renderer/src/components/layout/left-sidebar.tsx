import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  KanbanSquare,
  ListTodo,
  ListChecks,
  Server,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLanguage } from '@/providers/language-provider';

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
};

export function LeftSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard, path: '/dashboard' },
    { id: 'tasks', label: t.nav.tasks, icon: ListTodo, path: '/tasks' },
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

  return (
    <aside
      className={cn(
        'bg-sidebar flex h-full shrink-0 flex-col transition-all duration-300 ease-in-out',
        collapsed ? 'w-12' : 'w-40'
      )}
    >
      <Navigation
        items={navItems}
        currentPath={location.pathname}
        collapsed={collapsed}
        onNavigate={handleNavClick}
      />
    </aside>
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
    <nav className="flex flex-col gap-1 px-2 py-2">
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
                    'flex size-8 cursor-pointer items-center justify-center rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="size-4" />
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
              'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-all duration-200',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
