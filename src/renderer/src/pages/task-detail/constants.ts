import { CheckCircle, Clock, Play } from 'lucide-react';

import type { PipelineDisplayStatus } from './types';

export const statusConfig: Record<
  PipelineDisplayStatus,
  { icon: typeof Clock; label: string; color: string }
> = {
  todo: {
    icon: Clock,
    label: 'Todo',
    color: 'text-slate-500 bg-slate-500/10',
  },
  in_progress: {
    icon: Play,
    label: 'In Progress',
    color: 'text-blue-500 bg-blue-500/10',
  },
  in_review: {
    icon: Clock,
    label: 'In Review',
    color: 'text-amber-500 bg-amber-500/10',
  },
  done: {
    icon: CheckCircle,
    label: 'Done',
    color: 'text-green-500 bg-green-500/10',
  },
};
