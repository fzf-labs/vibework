import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { db, type AgentToolConfig } from '@/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useLanguage } from '@/providers/language-provider';

export interface TaskNodeTemplateDraft {
  name: string;
  prompt: string;
  cliToolId: string;
  agentToolConfigId: string;
  requiresApproval: boolean;
  continueOnError: boolean;
}

interface CLIToolInfo {
  id: string;
  displayName?: string;
  name?: string;
  installed?: boolean;
}

export interface WorkflowTemplateFormValues {
  name: string;
  description?: string;
  nodes: Array<{
    name: string;
    prompt: string;
    cliToolId?: string;
    agentToolConfigId?: string;
    requiresApproval: boolean;
    continueOnError: boolean;
  }>;
}

interface WorkflowTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValues?: WorkflowTemplateFormValues | null;
  onSubmit: (values: WorkflowTemplateFormValues) => Promise<void>;
}

const DEFAULT_NODE: TaskNodeTemplateDraft = {
  name: '',
  prompt: '',
  cliToolId: '',
  agentToolConfigId: '',
  requiresApproval: true,
  continueOnError: false,
};

export function WorkflowTemplateDialog({
  open,
  onOpenChange,
  title,
  initialValues,
  onSubmit,
}: WorkflowTemplateDialogProps) {
  const { t } = useLanguage();
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateNodes, setTemplateNodes] = useState<TaskNodeTemplateDraft[]>([
    { ...DEFAULT_NODE },
  ]);
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([]);
  const [cliConfigsByTool, setCliConfigsByTool] = useState<
    Record<string, AgentToolConfig[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCliConfigs = useCallback(
    async (toolId: string): Promise<AgentToolConfig[]> => {
      if (!toolId) return [];
      const cached = cliConfigsByTool[toolId];
      if (cached) return cached;

      try {
        const result = await db.listAgentToolConfigs(toolId);
        const list = Array.isArray(result)
          ? (result as AgentToolConfig[])
          : [];
        setCliConfigsByTool((prev) =>
          prev[toolId] ? prev : { ...prev, [toolId]: list }
        );
        return list;
      } catch {
        setCliConfigsByTool((prev) =>
          prev[toolId] ? prev : { ...prev, [toolId]: [] }
        );
        return [];
      }
    },
    [cliConfigsByTool]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadTools = async () => {
      try {
        const detected =
          (await window.api?.cliTools?.getAll?.()) ||
          (await window.api?.cliTools?.detectAll?.());
        const tools = (Array.isArray(detected)
          ? detected
          : []) as CLIToolInfo[];
        const installedTools = tools.filter((tool) => tool.installed !== false);
        if (active) setCliTools(installedTools);
      } catch {
        if (active) setCliTools([]);
      }
    };
    void loadTools();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialValues) {
      setTemplateName(initialValues.name);
      setTemplateDescription(initialValues.description || '');
      setTemplateNodes(
        initialValues.nodes.length > 0
          ? initialValues.nodes.map((node) => ({
              ...DEFAULT_NODE,
              ...node,
              cliToolId: node.cliToolId || '',
              agentToolConfigId: node.agentToolConfigId || '',
            }))
          : [{ ...DEFAULT_NODE }]
      );
    } else {
      setTemplateName('');
      setTemplateDescription('');
      setTemplateNodes([{ ...DEFAULT_NODE }]);
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    const toolIds = Array.from(
      new Set(
        templateNodes
          .map((node) => node.cliToolId)
          .filter((toolId): toolId is string => Boolean(toolId))
      )
    );
    toolIds.forEach((toolId) => {
      void loadCliConfigs(toolId);
    });
  }, [loadCliConfigs, open, templateNodes]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateName.trim()) {
      setError(t.task.createTemplateNameRequired);
      return;
    }

    const nodes = templateNodes
      .map((node, index) => ({
        name: node.name.trim() || `${t.task.workflowNodeLabel} ${index + 1}`,
        prompt: node.prompt.trim(),
        cliToolId: node.cliToolId || undefined,
        agentToolConfigId: node.cliToolId
          ? node.agentToolConfigId || undefined
          : undefined,
        requiresApproval: node.requiresApproval,
        continueOnError: node.continueOnError,
      }))
      .filter((node) => node.prompt.length > 0);

    if (nodes.length === 0) {
      setError(t.task.createTemplateStageRequired);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        nodes,
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <div className="max-h-[45vh] overflow-y-auto overflow-x-hidden space-y-3 pr-1">
              {templateNodes.map((node, index) => (
                <div key={`node-${index}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">
                      {t.task.workflowNodeLabel} {index + 1}
                    </div>
                    {templateNodes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTemplateNodes((prev) =>
                            prev.filter((_, idx) => idx !== index)
                          );
                        }}
                      >
                        {t.common.remove}
                      </Button>
                    )}
                  </div>
                  <input
                    value={node.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTemplateNodes((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, name: value } : item
                        )
                      );
                    }}
                    placeholder={t.task.createStageNamePlaceholder}
                    className="mt-2 w-full rounded-md border bg-background px-2 py-1 text-sm"
                  />
                  <textarea
                    value={node.prompt}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTemplateNodes((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, prompt: value } : item
                        )
                      );
                    }}
                    placeholder={t.task.createStagePromptPlaceholder}
                    className="mt-2 w-full rounded-md border bg-background px-2 py-1 text-sm"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {t.task.createCliLabel}
                      </label>
                      <select
                        value={node.cliToolId || ''}
                        onChange={async (e) => {
                          const toolId = e.target.value;
                          let defaultConfigId = '';
                          if (toolId) {
                            const configs =
                              cliConfigsByTool[toolId] ||
                              (await loadCliConfigs(toolId));
                            const defaultConfig = configs.find(
                              (cfg) => cfg.is_default
                            );
                            defaultConfigId = defaultConfig?.id || '';
                          }

                          setTemplateNodes((prev) =>
                            prev.map((item, idx) =>
                              idx === index
                                ? {
                                    ...item,
                                    cliToolId: toolId,
                                    agentToolConfigId: defaultConfigId,
                                  }
                                : item
                            )
                          );
                        }}
                        className="mt-1.5 w-full rounded-md border bg-background px-2 py-1 text-sm"
                      >
                        <option value="">{t.task.createStageCliInherit}</option>
                        {cliTools.map((tool) => (
                          <option key={tool.id} value={tool.id}>
                            {tool.displayName || tool.name || tool.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {t.task.createCliConfigLabel}
                      </label>
                      <select
                        value={node.agentToolConfigId || ''}
                        disabled={!node.cliToolId}
                        onChange={(e) => {
                          const configId = e.target.value;
                          setTemplateNodes((prev) =>
                            prev.map((item, idx) =>
                              idx === index
                                ? { ...item, agentToolConfigId: configId }
                                : item
                            )
                          );
                        }}
                        className="mt-1.5 w-full rounded-md border bg-background px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">
                          {!node.cliToolId
                            ? t.task.createCliConfigSelectTool
                            : t.task.createStageConfigInherit}
                        </option>
                        {(node.cliToolId
                          ? cliConfigsByTool[node.cliToolId] || []
                          : []
                        ).map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={node.requiresApproval}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTemplateNodes((prev) =>
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
                        checked={node.continueOnError}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTemplateNodes((prev) =>
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
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setTemplateNodes((prev) => [...prev, { ...DEFAULT_NODE }])
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
