import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useLanguage } from '@/providers/language-provider';

export interface PipelineTemplateStageDraft {
  name: string;
  prompt: string;
  requiresApproval: boolean;
  continueOnError: boolean;
}

export interface PipelineTemplateFormValues {
  name: string;
  description?: string;
  stages: PipelineTemplateStageDraft[];
}

interface PipelineTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValues?: PipelineTemplateFormValues | null;
  onSubmit: (values: PipelineTemplateFormValues) => Promise<void>;
}

const DEFAULT_STAGE: PipelineTemplateStageDraft = {
  name: '',
  prompt: '',
  requiresApproval: true,
  continueOnError: false,
};

export function PipelineTemplateDialog({
  open,
  onOpenChange,
  title,
  initialValues,
  onSubmit,
}: PipelineTemplateDialogProps) {
  const { t } = useLanguage();
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateStages, setTemplateStages] = useState<PipelineTemplateStageDraft[]>([
    { ...DEFAULT_STAGE },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialValues) {
      setTemplateName(initialValues.name);
      setTemplateDescription(initialValues.description || '');
      setTemplateStages(
        initialValues.stages.length > 0
          ? initialValues.stages.map((stage) => ({ ...stage }))
          : [{ ...DEFAULT_STAGE }]
      );
    } else {
      setTemplateName('');
      setTemplateDescription('');
      setTemplateStages([{ ...DEFAULT_STAGE }]);
    }
  }, [open, initialValues]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateName.trim()) {
      setError(t.task.createTemplateNameRequired);
      return;
    }

    const stages = templateStages
      .map((stage, index) => ({
        name: stage.name.trim() || `${t.task.stageLabel} ${index + 1}`,
        prompt: stage.prompt.trim(),
        requiresApproval: stage.requiresApproval,
        continueOnError: stage.continueOnError,
      }))
      .filter((stage) => stage.prompt.length > 0);

    if (stages.length === 0) {
      setError(t.task.createTemplateStageRequired);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        stages,
      });
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              {t.task.createTemplateNameLabel}
            </label>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t.task.createTemplateNamePlaceholder}
              className={cn(
                'mt-1.5 w-full px-3 py-2 text-sm',
                'bg-background border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              {t.task.createTemplateDescriptionLabel}
            </label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder={t.task.createTemplateDescriptionPlaceholder}
              className={cn(
                'mt-1.5 w-full min-h-[80px] px-3 py-2 text-sm',
                'bg-background border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary'
              )}
            />
          </div>

          <div className="space-y-3">
            {templateStages.map((stage, index) => (
              <div key={`stage-${index}`} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">
                    {t.task.stageLabel} {index + 1}
                  </div>
                  {templateStages.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTemplateStages((prev) =>
                          prev.filter((_, idx) => idx !== index)
                        );
                      }}
                    >
                      {t.common.remove}
                    </Button>
                  )}
                </div>
                <input
                  value={stage.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTemplateStages((prev) =>
                      prev.map((item, idx) =>
                        idx === index ? { ...item, name: value } : item
                      )
                    );
                  }}
                  placeholder={t.task.createStageNamePlaceholder}
                  className="mt-2 w-full rounded-md border bg-background px-2 py-1 text-sm"
                />
                <textarea
                  value={stage.prompt}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTemplateStages((prev) =>
                      prev.map((item, idx) =>
                        idx === index ? { ...item, prompt: value } : item
                      )
                    );
                  }}
                  placeholder={t.task.createStagePromptPlaceholder}
                  className="mt-2 w-full rounded-md border bg-background px-2 py-1 text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stage.requiresApproval}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTemplateStages((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, requiresApproval: checked }
                              : item
                          )
                        );
                      }}
                    />
                    {t.task.createStageRequiresApproval}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stage.continueOnError}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTemplateStages((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, continueOnError: checked }
                              : item
                          )
                        );
                      }}
                    />
                    {t.task.createStageContinueOnError}
                  </label>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setTemplateStages((prev) => [...prev, { ...DEFAULT_STAGE }])
              }
            >
              {t.task.addStage}
            </Button>
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t.task.createLoading : t.task.saveTemplate}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
