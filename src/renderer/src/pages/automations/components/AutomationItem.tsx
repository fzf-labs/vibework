import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TriggerBadge } from '@/components/automation/TriggerBadge';
import type { Automation, AutomationRun } from '@/types/automation';
import { AutomationRunList } from './AutomationRunList';

interface AutomationItemProps {
  automation: Automation;
  runs: AutomationRun[];
  runsLoading?: boolean;
  onRunNow: (automation: Automation) => Promise<void>;
  onToggleEnabled: (automation: Automation, enabled: boolean) => Promise<void>;
  onEdit: (automation: Automation) => void;
  onDelete: (automation: Automation) => Promise<void>;
  onOpenTask: (taskId: string) => void;
}

const formatLastRun = (automation: Automation): string => {
  if (!automation.last_run_at || !automation.last_status) {
    return '暂无运行记录';
  }

  const statusText: Record<string, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    skipped: '跳过',
  };

  return `${statusText[automation.last_status] || automation.last_status} · ${new Date(
    automation.last_run_at
  ).toLocaleString()}`;
};

export function AutomationItem({
  automation,
  runs,
  runsLoading = false,
  onRunNow,
  onToggleEnabled,
  onEdit,
  onDelete,
  onOpenTask,
}: AutomationItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{automation.name}</h3>
            <TriggerBadge automation={automation} />
            {automation.enabled ? (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-600">
                已启用
              </span>
            ) : (
              <span className="rounded bg-zinc-500/10 px-1.5 py-0.5 text-[11px] text-zinc-600">
                已停用
              </span>
            )}
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            <div>项目：{automation.template_json.projectPath || '-'}</div>
            <div>下次执行：{new Date(automation.next_run_at).toLocaleString()}</div>
            <div>上次：{formatLastRun(automation)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '收起记录' : '查看记录'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onRunNow(automation)}>
            立即执行
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onToggleEnabled(automation, !automation.enabled)}
          >
            {automation.enabled ? '停用' : '启用'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(automation)}>
            编辑
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(automation)}>
            删除
          </Button>
        </div>
      </div>

      {expanded ? (
        <AutomationRunList
          runs={runs}
          loading={runsLoading}
          onOpenTask={(taskId) => onOpenTask(taskId)}
        />
      ) : null}
    </div>
  );
}

