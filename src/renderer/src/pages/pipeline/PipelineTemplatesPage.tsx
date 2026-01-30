import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { db } from '@/data';
import { useLanguage } from '@/providers/language-provider';
import {
  WorkflowTemplateDialog,
  type WorkflowTemplateFormValues,
} from '@/components/pipeline';

// Legacy type alias for backward compatibility
type PipelineTemplateFormValues = WorkflowTemplateFormValues;

interface WorkNodeTemplate {
  id: string;
  workflow_template_id: string;
  node_order: number;
  name: string;
  prompt: string;
  requires_approval: boolean;
  continue_on_error: boolean;
  created_at: string;
  updated_at: string;
}

interface PipelineTemplate {
  id: string;
  name: string;
  description?: string | null;
  scope: 'global' | 'project';
  project_id?: string | null;
  nodes: WorkNodeTemplate[];
  created_at: string;
  updated_at: string;
}

const toNodeInputs = (values: PipelineTemplateFormValues) =>
  values.nodes.map((node, index) => ({
    name: node.name,
    prompt: node.prompt,
    node_order: index + 1,
    requires_approval: node.requiresApproval,
    continue_on_error: node.continueOnError,
  }));

export function PipelineTemplatesPage() {
  const { t } = useLanguage();
  const { currentProject } = useProjects();
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<PipelineTemplate[]>([]);
  const [copyTemplateId, setCopyTemplateId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<PipelineTemplate | null>(null);

  const projectId = currentProject?.id;

  const loadTemplates = async () => {
    if (!projectId) {
      setTemplates([]);
      return;
    }
    const list = (await db.getWorkflowTemplatesByProject(
      projectId
    )) as PipelineTemplate[];
    setTemplates(list);
  };

  const loadGlobalTemplates = async () => {
    const list = (await db.getGlobalWorkflowTemplates()) as PipelineTemplate[];
    setGlobalTemplates(list);
  };

  useEffect(() => {
    void loadTemplates();
  }, [projectId]);

  useEffect(() => {
    setCopyTemplateId('');
  }, [projectId]);

  useEffect(() => {
    void loadGlobalTemplates();
  }, []);

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: PipelineTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: PipelineTemplateFormValues) => {
    if (!projectId) return;
    if (editingTemplate) {
      await db.updateWorkflowTemplate({
        id: editingTemplate.id,
        scope: 'project',
        project_id: projectId,
        name: values.name,
        description: values.description,
        nodes: toNodeInputs(values),
      });
    } else {
      await db.createWorkflowTemplate({
        scope: 'project',
        project_id: projectId,
        name: values.name,
        description: values.description,
        nodes: toNodeInputs(values),
      });
    }
    await loadTemplates();
  };

  const handleDelete = async (template: PipelineTemplate) => {
    if (
      !confirm(
        t.task.pipelineTemplateDeleteConfirm.replace('{name}', template.name)
      )
    ) {
      return;
    }
    await db.deleteWorkflowTemplate(template.id, 'project');
    await loadTemplates();
  };

  const handleCopyFromGlobal = async () => {
    if (!projectId || !copyTemplateId) return;
    await db.copyGlobalWorkflowToProject(copyTemplateId, projectId);
    setCopyTemplateId('');
    await loadTemplates();
  };

  const stageCount = (template: PipelineTemplate) =>
    t.task.pipelineTemplateStageCount.replace(
      '{count}',
      `${template.nodes?.length || 0}`
    );

  const dialogTitle = editingTemplate
    ? t.task.pipelineTemplateEditTitle
    : t.task.pipelineTemplateCreateTitle;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t.task.pipelineTemplatePageTitle}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {currentProject
              ? t.task.pipelineTemplatePageDescription.replace(
                  '{project}',
                  currentProject.name
                )
              : t.task.pipelineTemplateNoProject}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={!projectId}>
          {t.task.createTemplateButton}
        </Button>
      </div>

      {currentProject && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium">
            {t.task.pipelineTemplateCopyLabel}
          </div>
          <select
            value={copyTemplateId}
            onChange={(e) => setCopyTemplateId(e.target.value)}
            className="min-w-[220px] rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {t.task.pipelineTemplateCopyPlaceholder}
            </option>
            {globalTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={handleCopyFromGlobal}
            disabled={!copyTemplateId}
          >
            {t.task.pipelineTemplateCopyButton}
          </Button>
          {globalTemplates.length === 0 && (
            <span className="text-muted-foreground text-xs">
              {t.task.pipelineTemplateGlobalEmpty}
            </span>
          )}
        </div>
      )}

      {!currentProject ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <div className="text-lg font-medium">
            {t.task.pipelineTemplateNoProjectTitle}
          </div>
          <div className="text-muted-foreground mt-2 max-w-md text-sm">
            {t.task.pipelineTemplateNoProject}
          </div>
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <div className="text-lg font-medium">
            {t.task.pipelineTemplateEmptyTitle}
          </div>
          <div className="text-muted-foreground mt-2 max-w-md text-sm">
            {t.task.pipelineTemplateEmptyDescription}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-md border bg-card px-3 py-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold truncate">
                      {template.name}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:bg-muted flex size-6 items-center justify-center rounded-md transition-colors"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEdit(template)}
                        >
                          {t.common.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(template)}
                        >
                          {t.common.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="text-muted-foreground mt-1 truncate text-xs">
                    {template.description || t.task.pipelineTemplateNoDescription}
                  </div>
                  <div className="text-muted-foreground mt-2 text-xs">
                    {stageCount(template)}
                  </div>
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    {t.task.pipelineTemplateUpdatedAt.replace(
                      '{time}',
                      new Date(template.updated_at).toLocaleString()
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <WorkflowTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        initialValues={
          editingTemplate
            ? {
                name: editingTemplate.name,
                description: editingTemplate.description || undefined,
                nodes: (editingTemplate.nodes || []).map((node) => ({
                  name: node.name,
                  prompt: node.prompt,
                  requiresApproval: node.requires_approval,
                  continueOnError: node.continue_on_error,
                })),
              }
            : null
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}
