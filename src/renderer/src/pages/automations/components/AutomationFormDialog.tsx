import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useProjects';
import type { AgentToolConfig } from '@/data';
import type { Automation, AutomationTriggerType } from '@/types/automation';
import { normalizeCliTools, type CLIToolInfo } from '@/lib/cli-tools';

interface AutomationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAutomation?: Automation | null;
  cliConfigs: AgentToolConfig[];
  onSubmit: (input: {
    name: string;
    enabled?: boolean;
    trigger_type: AutomationTriggerType;
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
  }) => Promise<void>;
}

const weekdayOptions = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

export function AutomationFormDialog({
  open,
  onOpenChange,
  initialAutomation,
  cliConfigs,
  onSubmit,
}: AutomationFormDialogProps) {
  const { currentProject } = useProjects();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>('daily');
  const [intervalSeconds, setIntervalSeconds] = useState(3600);
  const [dailyTime, setDailyTime] = useState('09:00');
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [weeklyTime, setWeeklyTime] = useState('09:00');
  const [cliToolId, setCliToolId] = useState('');
  const [cliConfigId, setCliConfigId] = useState('');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');

  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const loadTools = async () => {
      try {
        const result = await window.api.cliTools.getSnapshot();
        if (!active) return;
        const list = normalizeCliTools(result);
        setCliTools(list);
        void window.api.cliTools.refresh({ level: 'fast' });
      } catch {
        if (!active) return;
        setCliTools([]);
      }
    };

    const unsubscribe = window.api.cliTools.onUpdated((tools) => {
      if (!active) return;
      setCliTools(normalizeCliTools(tools));
    });

    void loadTools();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (initialAutomation) {
      setName(initialAutomation.name);
      setTriggerType(initialAutomation.trigger_type);
      setCliToolId(initialAutomation.template_json.cliToolId || '');
      setCliConfigId(initialAutomation.template_json.agentToolConfigId || '');
      setTitle(initialAutomation.template_json.title || '');
      setPrompt(initialAutomation.template_json.prompt || '');

      if (initialAutomation.trigger_type === 'interval') {
        const trigger = initialAutomation.trigger_json as { interval_seconds: number };
        setIntervalSeconds(trigger.interval_seconds || 3600);
      } else if (initialAutomation.trigger_type === 'daily') {
        const trigger = initialAutomation.trigger_json as { time: string };
        setDailyTime(trigger.time || '09:00');
      } else {
        const trigger = initialAutomation.trigger_json as {
          day_of_week: number;
          time: string;
        };
        setWeeklyDay(trigger.day_of_week || 1);
        setWeeklyTime(trigger.time || '09:00');
      }
      return;
    }

    setName('');
    setTriggerType('daily');
    setIntervalSeconds(3600);
    setDailyTime('09:00');
    setWeeklyDay(1);
    setWeeklyTime('09:00');
    setCliToolId('');
    setCliConfigId('');
    setTitle('每日代码检查 {{date}}');
    setPrompt('检查代码质量并生成报告');
  }, [initialAutomation, open]);

  useEffect(() => {
    if (!cliToolId) {
      setCliConfigId('');
      return;
    }

    const candidates = cliConfigs.filter((config) => config.tool_id === cliToolId);
    if (candidates.length === 0) {
      setCliConfigId('');
      return;
    }

    const exists = candidates.some((config) => config.id === cliConfigId);
    if (!exists) {
      const defaultConfig = candidates.find((config) => config.is_default);
      setCliConfigId(defaultConfig?.id || candidates[0].id);
    }
  }, [cliConfigId, cliConfigs, cliToolId]);

  const filteredConfigs = useMemo(
    () => cliConfigs.filter((config) => config.tool_id === cliToolId),
    [cliConfigs, cliToolId]
  );

  const triggerJson = useMemo(() => {
    if (triggerType === 'interval') {
      return { interval_seconds: Number(intervalSeconds) || 3600 };
    }
    if (triggerType === 'daily') {
      return { time: dailyTime || '09:00' };
    }
    return {
      day_of_week: Number(weeklyDay) || 1,
      time: weeklyTime || '09:00',
    };
  }, [dailyTime, intervalSeconds, triggerType, weeklyDay, weeklyTime]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('规则名称不能为空');
      return;
    }
    if (!title.trim()) {
      setError('任务标题不能为空');
      return;
    }
    if (!prompt.trim()) {
      setError('任务提示词不能为空');
      return;
    }
    if (!currentProject?.id || !currentProject?.path) {
      setError('请先选择当前项目');
      return;
    }
    if (!cliToolId) {
      setError('请选择 CLI 工具');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        trigger_type: triggerType,
        trigger_json: triggerJson,
        timezone: 'UTC',
        template_json: {
          title: title.trim(),
          prompt: prompt.trim(),
          taskMode: 'conversation',
          projectId: currentProject.id,
          projectPath: currentProject.path,
          createWorktree: currentProject.projectType === 'git',
          cliToolId,
          agentToolConfigId: cliConfigId || undefined,
        },
      });

      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="mb-1 flex flex-col items-center gap-2 text-center">
            <div className="bg-muted flex size-10 items-center justify-center rounded-full">
              <Sparkles className="size-5" />
            </div>
            <DialogTitle className="text-2xl">
              {initialAutomation ? '编辑定时规则' : '新建定时规则'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form className="space-y-4 overflow-y-auto pr-1" onSubmit={submit}>
          <div className="rounded-lg border bg-muted/20 p-4">
            <label className="text-xs font-medium text-muted-foreground">规则名称</label>
            <input
              className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：每日代码检查"
              autoFocus
            />

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-dashed bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                当前项目：{currentProject?.name || '未选择'}
              </div>
              <div className="rounded-md border border-dashed bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                时区：UTC（固定）
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">触发方式</label>
                <select
                  className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={triggerType}
                  onChange={(event) => setTriggerType(event.target.value as AutomationTriggerType)}
                >
                  <option value="interval">间隔触发</option>
                  <option value="daily">每日</option>
                  <option value="weekly">每周</option>
                </select>
              </div>

              {triggerType === 'interval' ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">间隔秒数</label>
                  <input
                    type="number"
                    min={1}
                    className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={intervalSeconds}
                    onChange={(event) => setIntervalSeconds(Number(event.target.value))}
                  />
                </div>
              ) : triggerType === 'daily' ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">每日时间</label>
                  <input
                    type="time"
                    className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={dailyTime}
                    onChange={(event) => setDailyTime(event.target.value)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">星期</label>
                    <select
                      className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={weeklyDay}
                      onChange={(event) => setWeeklyDay(Number(event.target.value))}
                    >
                      {weekdayOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">时间</label>
                    <input
                      type="time"
                      className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={weeklyTime}
                      onChange={(event) => setWeeklyTime(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">CLI 工具</label>
                <select
                  className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={cliToolId}
                  onChange={(event) => setCliToolId(event.target.value)}
                >
                  <option value="">请选择 CLI 工具</option>
                  {cliTools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.displayName || tool.name || tool.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">CLI 配置（可选）</label>
                <select
                  className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={cliConfigId}
                  onChange={(event) => setCliConfigId(event.target.value)}
                  disabled={!cliToolId}
                >
                  <option value="">默认配置</option>
                  {filteredConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">任务标题</label>
              <input
                className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="支持 {{date}} / {{datetime}} 模板变量"
              />
            </div>

            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground">任务提示词</label>
              <textarea
                className="mt-1.5 min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="例如：检查代码质量并生成报告"
              />
            </div>
          </div>

          {error ? <div className="text-xs text-destructive">{error}</div> : null}

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : initialAutomation ? '保存修改' : '创建规则'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
