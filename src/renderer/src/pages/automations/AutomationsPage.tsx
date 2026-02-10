import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, type AgentToolConfig } from '@/data';
import { useProjects } from '@/hooks/useProjects';
import type { Automation, AutomationRun } from '@/types/automation';
import { AutomationFormDialog } from './components/AutomationFormDialog';
import { AutomationList } from './components/AutomationList';

export function AutomationsPage() {
  const navigate = useNavigate();
  const { currentProject } = useProjects();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runsByAutomationId, setRunsByAutomationId] = useState<Record<string, AutomationRun[]>>({});
  const [runsLoadingByAutomationId, setRunsLoadingByAutomationId] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [cliConfigs, setCliConfigs] = useState<AgentToolConfig[]>([]);

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const [list, configs] = await Promise.all([
        db.listAutomations(),
        db.listAgentToolConfigs() as Promise<AgentToolConfig[]>,
      ]);

      const filteredByProject = currentProject?.id
        ? list.filter((automation) => automation.template_json.projectId === currentProject.id)
        : list;

      setAutomations(filteredByProject);
      setCliConfigs(configs);

      const runsMap: Record<string, AutomationRun[]> = {};
      for (const automation of filteredByProject) {
        runsMap[automation.id] = await db.listAutomationRuns(automation.id, 20);
      }
      setRunsByAutomationId(runsMap);
    } catch (error) {
      console.error('[AutomationsPage] Failed to load automations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    void loadAutomations();
  }, [loadAutomations]);

  const filteredAutomations = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return automations;

    return automations.filter((automation) => {
      const target = [
        automation.name,
        automation.template_json.title,
        automation.template_json.prompt,
        automation.template_json.projectPath,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return target.includes(keyword);
    });
  }, [automations, searchKeyword]);

  const refreshAutomationRuns = useCallback(async (automationId: string) => {
    setRunsLoadingByAutomationId((prev) => ({ ...prev, [automationId]: true }));

    try {
      const runs = await db.listAutomationRuns(automationId, 20);
      setRunsByAutomationId((prev) => ({ ...prev, [automationId]: runs }));
    } catch (error) {
      console.error('[AutomationsPage] Failed to refresh automation runs:', error);
    } finally {
      setRunsLoadingByAutomationId((prev) => ({ ...prev, [automationId]: false }));
    }
  }, []);

  const handleCreate = () => {
    if (!currentProject?.id) return;
    setEditingAutomation(null);
    setDialogOpen(true);
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setDialogOpen(true);
  };

  const handleDelete = useCallback(
    async (automation: Automation) => {
      const confirmed = confirm(`确认删除规则「${automation.name}」吗？`);
      if (!confirmed) return;

      await db.deleteAutomation(automation.id);
      await loadAutomations();
    },
    [loadAutomations]
  );

  const handleToggleEnabled = useCallback(
    async (automation: Automation, enabled: boolean) => {
      await db.setAutomationEnabled(automation.id, enabled);
      await loadAutomations();
    },
    [loadAutomations]
  );

  const handleRunNow = useCallback(
    async (automation: Automation) => {
      await db.runAutomationNow(automation.id);
      await refreshAutomationRuns(automation.id);
      await loadAutomations();
    },
    [loadAutomations, refreshAutomationRuns]
  );

  const handleSubmit = useCallback(
    async (input: {
      name: string;
      enabled?: boolean;
      trigger_type: 'interval' | 'daily' | 'weekly';
      trigger_json: Record<string, unknown>;
      timezone: string;
      template_json: {
        title: string;
        prompt: string;
        taskMode: 'conversation';
        projectId?: string;
        projectPath?: string;
        createWorktree?: boolean;
        baseBranch?: string;
        worktreeBranchPrefix?: string;
        worktreeRootPath?: string;
        cliToolId?: string;
        agentToolConfigId?: string;
      };
    }) => {
      setSaving(true);
      try {
        if (editingAutomation) {
          await db.updateAutomation(editingAutomation.id, input as Record<string, unknown>);
          await refreshAutomationRuns(editingAutomation.id);
        } else {
          await db.createAutomation(input as Record<string, unknown>);
        }
        await loadAutomations();
      } finally {
        setSaving(false);
      }
    },
    [editingAutomation, loadAutomations, refreshAutomationRuns]
  );

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理定时自动执行规则和运行记录</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
            placeholder="搜索规则"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
          />
          <Button onClick={handleCreate} disabled={!currentProject?.id}>
            <Plus className="mr-1 size-4" />
            新建规则
          </Button>
        </div>
      </div>

      {!currentProject?.id ? (
        <div className="mt-6 rounded-md border border-dashed bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
          请先在左侧选择当前项目，再创建自动化规则。
        </div>
      ) : null}

      <div className="mt-5 flex-1 overflow-auto">
        <AutomationList
          automations={filteredAutomations}
          runsByAutomationId={runsByAutomationId}
          runsLoadingByAutomationId={runsLoadingByAutomationId}
          loading={loading}
          onRunNow={handleRunNow}
          onToggleEnabled={handleToggleEnabled}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onOpenTask={(taskId) => navigate(`/task/${taskId}`)}
        />
      </div>

      <AutomationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setDialogOpen(open);
          }
        }}
        initialAutomation={editingAutomation}
        cliConfigs={cliConfigs}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
