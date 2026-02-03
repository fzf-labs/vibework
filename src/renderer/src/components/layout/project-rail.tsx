import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsModal } from '@/components/settings';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProjects, type Project } from '@/hooks/useProjects';

export function ProjectRail() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    projects,
    currentProject,
    setCurrentProjectId,
    checkProjectPath,
    refresh,
  } = useProjects();

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

  const hasProjects = projects.length > 0;

  return (
    <>
      <aside className="border-sidebar-border bg-sidebar flex h-full w-12 shrink-0 flex-col border-r">
        {/* Project List - Scrollable */}
        <div className="flex-1 overflow-y-auto py-2">
          {hasProjects ? (
            <div className="flex flex-col items-center gap-2">
              {projects.map((project) => (
                <ProjectAvatar
                  key={project.id}
                  project={project}
                  isActive={currentProject?.id === project.id}
                  onClick={() => handleSelectProject(project.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyProjectsHint onAddProject={() => navigate('/projects')} />
          )}
        </div>

        {/* Bottom Actions */}
        <div className="border-sidebar-border flex flex-col items-center gap-1 border-t py-2">
          {/* Add Project Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/projects')}
                aria-label="新建项目"
                className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
              >
                <Plus className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">新建项目</TooltipContent>
          </Tooltip>

          {/* Settings Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="设置"
                className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
              >
                <Settings className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

// Empty Projects Hint Component
function EmptyProjectsHint({ onAddProject }: { onAddProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 py-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onAddProject}
            className="text-muted-foreground hover:text-primary hover:border-primary flex size-8 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors"
          >
            <FolderPlus className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">创建你的第一个项目</TooltipContent>
      </Tooltip>
    </div>
  );
}

// Project Avatar Component
function ProjectAvatar({
  project,
  isActive,
  onClick,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}) {
  // Get first character of project name
  const initial = project.name.charAt(0).toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative flex items-center">
          {/* Active indicator */}
          {isActive && (
            <div className="bg-primary absolute left-0 h-5 w-1 rounded-r-full" />
          )}
          <button
            onClick={onClick}
            aria-label={project.name}
            className={cn(
              'flex size-8 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold transition-all',
              isActive
                ? 'bg-primary text-primary-foreground scale-110 shadow-md'
                : 'bg-primary/20 text-primary hover:bg-primary/40 hover:scale-105'
            )}
          >
            {initial}
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{project.name}</TooltipContent>
    </Tooltip>
  );
}
