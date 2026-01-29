import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjects, type Project } from '@/hooks/useProjects';
import {
  CreateProjectDialog,
  ProjectEditDialog,
} from '@/components/projects/ProjectDialogs';
import { MoreVertical } from 'lucide-react';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    setCurrentProjectId,
  } = useProjects();

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects]
  );

  const handleDeleteProject = async (project: Project) => {
    if (confirm(`确定要删除项目“${project.name}”吗？`)) {
      await deleteProject(project.id);
    }
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProjectId(project.id);
    navigate('/dashboard');
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">项目管理</h1>
          <p className="text-muted-foreground mt-2">
            在这里创建、编辑或删除项目。
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>新建项目</Button>
      </div>

      {sortedProjects.length === 0 ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <div className="text-lg font-medium">暂无项目</div>
          <div className="text-muted-foreground mt-2 max-w-md text-sm">
            创建一个项目来开始使用 VibeWork。项目可以是本地目录或通过仓库克隆。
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => handleOpenProject(project)}
              className="rounded-md border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold truncate">{project.name}</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="text-muted-foreground hover:bg-muted flex size-6 items-center justify-center rounded-md transition-colors"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditProject(project);
                          }}
                        >
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteProject(project);
                          }}
                        >
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="text-muted-foreground mt-1 truncate text-xs">
                    {project.path}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs truncate">
                    {project.description || '暂无描述'}
                  </div>
                  <div className="text-muted-foreground mt-2 text-[11px]">
                    最近更新：{new Date(project.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAddProject={addProject}
        onSetCurrentProject={setCurrentProjectId}
      />
      <ProjectEditDialog
        project={editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
        onUpdate={updateProject}
      />
    </div>
  );
}
