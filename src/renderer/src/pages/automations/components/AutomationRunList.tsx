import type { AutomationRun } from '@/types/automation';

interface AutomationRunListProps {
  runs: AutomationRun[];
  loading?: boolean;
  onOpenTask?: (taskId: string) => void;
}

const statusLabel: Record<AutomationRun['status'], string> = {
  running: '运行中',
  success: '成功',
  failed: '失败',
  skipped: '跳过',
};

const statusClassName: Record<AutomationRun['status'], string> = {
  running: 'bg-blue-500/10 text-blue-600',
  success: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
  skipped: 'bg-zinc-500/10 text-zinc-600',
};

const formatTime = (value: string | null): string => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

export function AutomationRunList({ runs, loading = false, onOpenTask }: AutomationRunListProps) {
  if (loading) {
    return <div className="py-3 text-sm text-muted-foreground">加载运行记录中...</div>;
  }

  if (runs.length === 0) {
    return <div className="py-3 text-sm text-muted-foreground">暂无运行记录</div>;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-md border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">计划时间</th>
            <th className="px-3 py-2 font-medium">触发时间</th>
            <th className="px-3 py-2 font-medium">状态</th>
            <th className="px-3 py-2 font-medium">关联任务</th>
            <th className="px-3 py-2 font-medium">错误信息</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t">
              <td className="px-3 py-2">{formatTime(run.scheduled_at)}</td>
              <td className="px-3 py-2">{formatTime(run.triggered_at)}</td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 ${statusClassName[run.status]}`}>
                  {statusLabel[run.status]}
                </span>
              </td>
              <td className="px-3 py-2">
                {run.task_id ? (
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => onOpenTask?.(run.task_id as string)}
                  >
                    {run.task_id}
                  </button>
                ) : (
                  '-'
                )}
              </td>
              <td className="max-w-[300px] truncate px-3 py-2 text-muted-foreground">
                {run.error_message || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

