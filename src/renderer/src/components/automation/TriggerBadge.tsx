import type { Automation } from '@/types/automation';
import { cn } from '@/lib/utils';

const weekdayLabels: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
};

interface TriggerBadgeProps {
  automation: Pick<Automation, 'trigger_type' | 'trigger_json'>;
  className?: string;
}

const formatInterval = (seconds: number): string => {
  if (seconds % 3600 === 0) {
    return `每 ${seconds / 3600} 小时`;
  }

  if (seconds % 60 === 0) {
    return `每 ${seconds / 60} 分钟`;
  }

  return `每 ${seconds} 秒`;
};

export function formatTriggerLabel(automation: Pick<Automation, 'trigger_type' | 'trigger_json'>): string {
  if (automation.trigger_type === 'interval') {
    const trigger = automation.trigger_json as { interval_seconds: number };
    return formatInterval(trigger.interval_seconds);
  }

  if (automation.trigger_type === 'daily') {
    const trigger = automation.trigger_json as { time: string };
    return `每日 ${trigger.time}`;
  }

  const trigger = automation.trigger_json as { day_of_week: number; time: string };
  const dayLabel = weekdayLabels[trigger.day_of_week] || `周${trigger.day_of_week}`;
  return `每周 ${dayLabel} ${trigger.time}`;
}

export function TriggerBadge({ automation, className }: TriggerBadgeProps) {
  const label = formatTriggerLabel(automation);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground',
        className
      )}
    >
      {label}
    </span>
  );
}

