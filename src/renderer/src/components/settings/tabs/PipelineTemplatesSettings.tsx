import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { db } from '@/data';
import { useLanguage } from '@/providers/language-provider';
import {
  PipelineTemplateDialog,
  type PipelineTemplateFormValues,
} from '@/components/pipeline';

interface PipelineTemplateStage {
  id: string;
  template_id: string;
  stage_order: number;
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
  stages: PipelineTemplateStage[];
  created_at: string;
  updated_at: string;
}

const toStageInputs = (values: PipelineTemplateFormValues) =>
  values.stages.map((stage, index) => ({
    name: stage.name,
    prompt: stage.prompt,
    stage_order: index + 1,
    requires_approval: stage.requiresApproval,
    continue_on_error: stage.continueOnError,
  }));

export function PipelineTemplatesSettings() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<PipelineTemplate | null>(null);

  const loadTemplates = async () => {
    const list = (await db.getGlobalPipelineTemplates()) as PipelineTemplate[];
    setTemplates(list);
  };

  useEffect(() => {
    void loadTemplates();
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
    if (editingTemplate) {
      await db.updatePipelineTemplate({
        id: editingTemplate.id,
        scope: 'global',
        name: values.name,
        description: values.description,
        stages: toStageInputs(values),
      });
    } else {
      await db.createPipelineTemplate({
        scope: 'global',
        name: values.name,
        description: values.description,
        stages: toStageInputs(values),
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
    await db.deletePipelineTemplate(template.id, 'global');
    await loadTemplates();
  };

  const stageCount = (template: PipelineTemplate) =>
    t.task.pipelineTemplateStageCount.replace(
      '{count}',
      `${template.stages?.length || 0}`
    );

  const dialogTitle = editingTemplate
    ? t.task.pipelineTemplateEditTitle
    : t.task.pipelineTemplateCreateTitle;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {t.settings.globalPipelineTemplatesTitle}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {t.settings.globalPipelineTemplatesDescription}
          </p>
        </div>
        <Button onClick={handleCreate}>{t.task.createTemplateButton}</Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t.settings.globalPipelineTemplatesEmpty}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

      <PipelineTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        initialValues={
          editingTemplate
            ? {
                name: editingTemplate.name,
                description: editingTemplate.description || undefined,
                stages: editingTemplate.stages.map((stage) => ({
                  name: stage.name,
                  prompt: stage.prompt,
                  requiresApproval: stage.requires_approval,
                  continueOnError: stage.continue_on_error,
                })),
              }
            : null
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}
