import type { Automation, AutomationRun } from '@/types/automation';
import { AutomationItem } from './AutomationItem';

interface AutomationListProps {
  automations: Automation[];
  runsByAutomationId: Record<string, AutomationRun[]>;
  runsLoadingByAutomationId: Record<string, boolean>;
  loading?: boolean;
  onRunNow: (automation: Automation) => Promise<void>;
  onToggleEnabled: (automation: Automation, enabled: boolean) => Promise<void>;
  onEdit: (automation: Automation) => void;
  onDelete: (automation: Automation) => Promise<void>;
  onOpenTask: (taskId: string) => void;
}

export function AutomationList({
  automations,
  runsByAutomationId,
  runsLoadingByAutomationId,
  loading = false,
  onRunNow,
  onToggleEnabled,
  onEdit,
  onDelete,
  onOpenTask,
}: AutomationListProps) {
  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">加载规则中...</div>;
  }

  if (automations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
        <div className="text-sm font-medium">暂无定时规则</div>
        <div className="mt-1 text-xs text-muted-foreground">点击右上角「新建规则」开始创建</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {automations.map((automation) => (
        <AutomationItem
          key={automation.id}
          automation={automation}
          runs={runsByAutomationId[automation.id] || []}
          runsLoading={runsLoadingByAutomationId[automation.id] || false}
          onRunNow={onRunNow}
          onToggleEnabled={onToggleEnabled}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}

